"""A deterministic, inspectable baseline experiment. Standard-library only."""
import argparse
import csv
import html
import json
import math
import pathlib
import random
import shutil
import statistics
import time


def run(output, source=None, seed=42):
    output = pathlib.Path(output)
    output.mkdir(parents=True, exist_ok=True)
    if source:
        with open(source, encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))
        if not rows or len(rows) > 20000 or "value" not in rows[0]:
            raise ValueError("CSV 需要 value 列、1—20000 行；可选 label 列用 0/1 标记异常。")
        values = [float(row["value"]) for row in rows]
        if any(not math.isfinite(value) for value in values):
            raise ValueError("value 必须是有限数值，不能含 NaN 或 Infinity。")
        labelled = "label" in rows[0] and all(row.get("label") in ("0", "1") for row in rows)
        labels = [int(row["label"]) for row in rows] if labelled else None
        data_source = "user_csv"
    else:
        generator = random.Random(seed)
        values = [20 + 0.003 * i + generator.gauss(0, 0.35) for i in range(360)]
        labels = [0] * len(values)
        for index, delta in [(45, 3.4), (91, -3.7), (148, 4.0), (203, -3.0), (269, 3.8), (322, -3.8)]:
            values[index] += delta
            labels[index] = 1
        data_source = "synthetic"
    with (output / "sensor.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["index", "value", "label"] if labels is not None else ["index", "value"])
        for index, value in enumerate(values):
            writer.writerow([index, value, labels[index]] if labels is not None else [index, value])

    started = time.perf_counter()
    mean = statistics.mean(values)
    deviation = statistics.pstdev(values) or 1e-9
    global_predictions = [int(abs(value - mean) / deviation > 3) for value in values]
    global_ms = (time.perf_counter() - started) * 1000
    started = time.perf_counter()
    rolling_predictions = []
    for index, value in enumerate(values):
        neighborhood = values[max(0, index - 15):index] + values[index + 1:min(len(values), index + 16)]
        if len(neighborhood) < 3:
            rolling_predictions.append(0)
            continue
        median = statistics.median(neighborhood)
        mad = statistics.median(abs(item - median) for item in neighborhood)
        rolling_predictions.append(int(abs(value - median) > max(3.5 * 1.4826 * mad, 0.05)))
    rolling_ms = (time.perf_counter() - started) * 1000

    def metrics(predictions, duration):
        result = {"predictedAnomalies": sum(predictions), "durationMs": round(duration, 4)}
        if labels is not None:
            tp = sum(actual == predicted == 1 for actual, predicted in zip(labels, predictions))
            fp = sum(actual == 0 and predicted == 1 for actual, predicted in zip(labels, predictions))
            fn = sum(actual == 1 and predicted == 0 for actual, predicted in zip(labels, predictions))
            precision = tp / (tp + fp) if tp + fp else None
            recall = tp / (tp + fn) if tp + fn else None
            f1 = 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else None
            result.update({"truePositive": tp, "falsePositive": fp, "falseNegative": fn, "precision": precision, "recall": recall, "f1": f1})
        return result

    summary = {"dataSource": data_source, "seed": seed, "samples": len(values), "labelled": labels is not None,
               "trueAnomalies": sum(labels) if labels is not None else None,
               "parameters": {"globalZThreshold": 3, "rollingRadius": 15, "madMultiplier": 3.5, "madScale": 1.4826, "minAbsoluteThreshold": 0.05},
               "methods": [{"id": "zscore", "name": "全局 Z-score", **metrics(global_predictions, global_ms)},
                           {"id": "rolling_mad", "name": "滚动中位数 MAD", **metrics(rolling_predictions, rolling_ms)}],
               "limitations": ["这是两种固定参数基线方法的单次对照，不证明普遍优越性。", "运行时间受到机器和调度影响，应重复测量。", "未提供可靠 label 时不能计算准确性指标。", "合成数据不代表真实设备或目标场景的性能。"]}
    (output / "results.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    with (output / "predictions.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["index", "value", "label", "zscore", "rolling_mad"])
        for index, value in enumerate(values):
            writer.writerow([index, value, labels[index] if labels is not None else "", global_predictions[index], rolling_predictions[index]])

    width, height, padding = 1040, 340, 42
    low, high = min(values), max(values)
    span = high - low or 1
    def point(index):
        return padding + index / max(len(values) - 1, 1) * (width - padding * 2), height - padding - (values[index] - low) / span * (height - padding * 2)
    points = " ".join(f"{point(index)[0]:.2f},{point(index)[1]:.2f}" for index in range(len(values)))
    marks = "".join(f'<circle cx="{point(index)[0]:.2f}" cy="{point(index)[1]:.2f}" r="5" fill="#c48c51" stroke="#fff" stroke-width="2"/>' for index in range(len(values)) if rolling_predictions[index])
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="Sensor series and rolling MAD anomaly predictions"><rect width="100%" height="100%" rx="18" fill="#f7f9f3"/><path d="M42 42V298H998" fill="none" stroke="#dce5d5"/><polyline points="{points}" fill="none" stroke="#597b47" stroke-width="2.2"/>{marks}<text x="45" y="25" font-family="sans-serif" font-size="12" fill="#6c7e62">{html.escape(data_source)} / {len(values)} samples / orange: rolling MAD predictions</text></svg>'
    (output / "chart.svg").write_text(svg, encoding="utf-8")
    source_label = "明确标注的合成传感器序列，非硬件采样" if data_source == "synthetic" else "用户提供的 CSV 数据；其来源和标签质量需由用户确认"
    lines = ["# 传感器异常检测：基线对照实验", "", f"数据来源：{source_label}。", f"样本数：{len(values)}。随机种子：{seed}。", "", "本实验由 AgentOS 内置流程在本地真实执行，未调用 Qwen。", "", "| 方法 | 预测异常数 | Precision | Recall | F1 | 单次耗时 ms |", "| --- | --- | --- | --- | --- | --- |"]
    def number(value):
        return "未定义/无标签" if value is None else f"{value:.4f}"
    for method in summary["methods"]:
        lines.append(f'| {method["name"]} | {method["predictedAnomalies"]} | {number(method.get("precision"))} | {number(method.get("recall"))} | {number(method.get("f1"))} | {method["durationMs"]} |')
    lines += ["", "## 参数", "", "```json", json.dumps(summary["parameters"], ensure_ascii=False, indent=2), "```", "", "## 局限", ""] + ["- " + item for item in summary["limitations"]]
    lines += ["", "## 复现", "", "在此目录执行：", "", "```text", "python reproduce.py --output rerun --source sensor.csv", "```", "", "比较确定性的预测与指标；运行时间无需逐位相同。"]
    (output / "report.md").write_text("\n".join(lines), encoding="utf-8")
    own = pathlib.Path(__file__).resolve()
    destination = (output / "reproduce.py").resolve()
    if own != destination:
        shutil.copyfile(own, destination)
    print(json.dumps({"status": "completed", "samples": len(values), "dataSource": data_source, "methods": summary["methods"]}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--source")
    parser.add_argument("--seed", type=int, default=42)
    arguments = parser.parse_args()
    run(arguments.output, arguments.source, arguments.seed)
