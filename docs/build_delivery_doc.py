from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from pathlib import Path


OUT = Path(__file__).parent / "AgentOS作品交付文档.docx"
GREEN = "244B37"
PALE = "EFF4EC"
PALE2 = "F7F9F5"
INK = "202820"
MUTED = "647064"
BORDER = "D7DED5"

TITLE = "AgentOS"
INTRO = (
    "AgentOS 是面向科研与学习的智能体操作系统，让人用自然语言调度电脑与智能设备。用户只需说出研究问题或工作目标，AgentOS 便能借助 Qwen 理解意图、规划任务，协同电脑中的应用、资料与工具，串联文献搜集、知识梳理、数据分析、实验验证和成果整理，把复杂工作持续推进为清晰、可追溯的成果。"
    "它让 AI 从“回答问题”进化为“理解目标、推进工作、协作交付”的科研伙伴。通过手中的 ESP32 硬件设备，用户可以自然地发出指令、触发电脑任务，让智能体能力从桌面延伸到真实环境，连接数字研究与物理世界。AgentOS 以 Qwen 为认知引擎，探索科研提效、认知增强与研发范式革新的全新方式。"
)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=110, start=140, bottom=110, end=140):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    margins = tc_pr.first_child_found_in("w:tcMar")
    if margins is None:
        margins = OxmlElement("w:tcMar")
        tc_pr.append(margins)
    for name, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = margins.find(qn(f"w:{name}"))
        if node is None:
            node = OxmlElement(f"w:{name}")
            margins.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "5")
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), BORDER)


def font(run, size=10.2, color=INK, bold=False, name="Microsoft YaHei"):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)
    return run


def set_cell_text(cell, text, *, size=9.2, color=INK, bold=False):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    font(p.add_run(text), size, color, bold)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    set_cell_margins(cell)


doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.27), Inches(11.69)
sec.top_margin, sec.bottom_margin = Inches(0.66), Inches(0.64)
sec.left_margin, sec.right_margin = Inches(0.78), Inches(0.78)

styles = doc.styles
normal = styles["Normal"]
normal.font.name = "Microsoft YaHei"
normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
normal.font.size = Pt(10.2)
normal.font.color.rgb = RGBColor.from_string(INK)
normal.paragraph_format.space_after = Pt(5)
normal.paragraph_format.line_spacing = 1.22
for style_name, size in (("Title", 28), ("Heading 1", 17), ("Heading 2", 12)):
    st = styles[style_name]
    st.font.name = "Microsoft YaHei"
    st._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    st.font.size = Pt(size)
    st.font.bold = True
    st.font.color.rgb = RGBColor.from_string("000000")
    st.paragraph_format.keep_with_next = True
    st.paragraph_format.space_before = Pt(12 if style_name != "Title" else 0)
    st.paragraph_format.space_after = Pt(5)

footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
footer.paragraph_format.space_before = Pt(0)
font(footer.add_run("AgentOS   作品交付说明   2026 年 10 月"), 8, MUTED)

p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(3)
font(p.add_run("PROJECT DELIVERY"), 9, GREEN, True, "Aptos")
p = doc.add_paragraph(style="Title")
font(p.add_run("AgentOS 作品交付文档"), 27, "000000", True)
p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(9)
font(p.add_run("报名信息   功能说明   运行与演示"), 11, MUTED)
p = doc.add_paragraph()
p.paragraph_format.space_after = Pt(11)
font(p.add_run(
    "本文件用于填写竞赛作品信息并介绍可交付软件。报名文案已按截图要求控制在 500 字以内；"
    "后文说明作品与 Qwen 科研提效赛题的关系、当前能实际运行的功能、安装方式和未完成事项。"
), 10.2, INK)

doc.add_heading("报名表可直接填写", level=1)
table = doc.add_table(rows=0, cols=2)
table.autofit = False
table.columns[0].width = Inches(1.3)
table.columns[1].width = Inches(5.41)
rows = [
    ("作品名称", TITLE),
    ("赛题方向", "阿里云特别赛题 Special Challenge：基于 Qwen 大模型的科研提效：认知增强与研发范式革新"),
    ("作品介绍", INTRO),
]
for idx, (label, value) in enumerate(rows):
    cells = table.add_row().cells
    cells[0].width, cells[1].width = Inches(1.3), Inches(5.41)
    set_cell_text(cells[0], label, size=9.5, bold=True, color=GREEN)
    set_cell_text(cells[1], value, size=9.15 if label == "作品介绍" else 9.5)
    set_cell_shading(cells[0], PALE)
    set_cell_shading(cells[1], PALE2 if idx % 2 == 0 else "FFFFFF")
set_table_borders(table)
p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(4)
font(p.add_run(f"作品介绍共 {len(INTRO)} 字，符合 500 字上限。"), 8.8, MUTED)

doc.add_heading("作品定位与解决的问题", level=1)
doc.add_paragraph(
    "研究和学习任务经常跨越文献、PDF、表格、代码和实验结果。用户需要反复切换应用、复制资料、运行脚本并整理过程，"
    "结果来源和处理步骤也容易散落在不同文件里。AgentOS 把这些步骤放进同一个自然语言对话：用户描述目标，"
    "模型按需调用资料与计算工具，系统保存操作记录和文件，用户可查看并复核。"
)
doc.add_paragraph(
    "长期产品定义是能直接操控电脑的小硬件。本次可交付范围是电脑端智能体软件，小硬件与 ESP32 仍未接入；"
    "因此本作品目前验证的是桌面软件工作流，而不是硬件控制效果。"
)

doc.add_heading("当前功能与状态", level=1)
table = doc.add_table(rows=1, cols=3)
table.autofit = False
widths = [1.5, 2.4, 2.81]
for cell, w, label in zip(table.rows[0].cells, widths, ("模块", "现状", "交付说明")):
    cell.width = Inches(w)
    set_cell_text(cell, label, size=9.3, color="FFFFFF", bold=True)
    set_cell_shading(cell, GREEN)
features = [
    ("桌面应用", "已构建 Windows x64 安装包", "Electron 桌面窗口；本机 Node 服务提供功能。"),
    ("AI 聊天", "可用", "支持连续对话及 OpenAI 兼容的 Qwen 模型与工具调用。"),
    ("研究资料", "可用", "空间内文件读写、上传下载、PDF 文本提取、公开文献和网页阅读。"),
    ("数据实验", "可用", "CSV 分析与本机 Python 执行；运行代码前需要用户确认。"),
    ("电脑操作", "基础适配，默认关闭", "读取窗口和可访问控件；操作按次确认，不支持任意应用的视觉控制。"),
    ("小硬件 / ESP32", "未接入", "没有扫描、连接、烧录或硬件实测。"),
]
for i, row in enumerate(features):
    cells = table.add_row().cells
    for cell, w, value in zip(cells, widths, row):
        cell.width = Inches(w)
        set_cell_text(cell, value, size=8.9)
        set_cell_shading(cell, PALE2 if i % 2 == 0 else "FFFFFF")
set_table_borders(table)

doc.add_page_break()
doc.add_heading("与 Qwen 科研提效赛题的关系", level=1)
doc.add_paragraph(
    "作品将 Qwen 作为理解自然语言目标、组织对话和选择工具的模型层；文件读取、文献元数据检索、Python 分析和结果写入由本地工具执行。"
    "这种设计重点是缩短“提出问题—整理材料—执行分析—检查结果”的操作路径，并将输入文件、脚本、日志和输出保留在研究空间，方便复核。"
)
doc.add_paragraph(
    "本机已联调的模型服务是 AIPing 转发的 Qwen3-Coder-30B-A3B-Instruct，接口兼容 OpenAI 格式；它不是直连阿里云百炼。"
    "项目支持配置阿里云百炼等兼容接口，但本次交付材料不包含 API Key。若特别赛题要求必须使用阿里云百炼，应在提交前改接百炼并重新验证，"
    "同时按主办方报名系统的实际选项确认赛道资格。"
)

doc.add_heading("软件运行方式", level=1)
steps = [
    ("安装", "运行 AgentOS-Setup-0.1.0.exe，按向导安装后从桌面或开始菜单打开。"),
    ("连接模型", "首次启动进入设置，填写获准使用的模型服务地址、模型名称和 API Key；密钥保存在本机设置中，不随安装包提供。"),
    ("开始对话", "直接在聊天框说出研究目标，可上传 PDF、CSV、Markdown 或代码资料。"),
    ("监督执行", "代码执行或电脑操作前检查确认卡片，批准或拒绝；结束后查看生成的文件、来源与执行记录。"),
]
table = doc.add_table(rows=0, cols=2)
table.autofit = False
table.columns[0].width, table.columns[1].width = Inches(1.0), Inches(5.71)
for i, (label, desc) in enumerate(steps):
    cells = table.add_row().cells
    cells[0].width, cells[1].width = Inches(1.0), Inches(5.71)
    set_cell_text(cells[0], label, size=9.4, color=GREEN, bold=True)
    set_cell_text(cells[1], desc, size=9.25)
    set_cell_shading(cells[0], PALE)
    set_cell_shading(cells[1], PALE2 if i % 2 == 0 else "FFFFFF")
set_table_borders(table)

doc.add_heading("建议现场演示", level=1)
for heading, body in [
    ("准备资料", "准备一份不含个人隐私的 CSV，包含 value 数值列；如要评估分类效果，再准备二值 label 列。"),
    ("给出任务", "在 AgentOS 聊天框输入：“分析这个 CSV 的缺失值和异常值，比较全局 Z-score 与滚动 MAD，保存一份包含方法、结果和局限的报告。”"),
    ("展示监督", "模型读取文件、提出 Python 执行请求后，演示者检查代码和确认卡片，再手动批准运行。"),
    ("核对产物", "展示生成的报告、CSV、脚本和日志，说明指标是否来自真实标签，并指出数据文件保存在本机研究空间。"),
]:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    font(p.add_run(heading + "  "), 10, GREEN, True)
    font(p.add_run(body), 10, INK)

doc.add_heading("提交材料与封面要求", level=1)
doc.add_paragraph(
    "截图提供两种提交方式：ZIP 作品包或魔搭创空间链接。本项目当前有 Windows 安装程序和本地源码，没有已发布的魔搭链接；"
    "若选择 ZIP，应将安装包、源码、项目说明和演示视频整理在一起，并排除 data/、API Key、个人研究资料、node_modules 和临时日志。"
    "当前安装程序约 110 MB，先确认报名系统的 ZIP 大小限制。"
)
doc.add_paragraph(
    "作品封面按截图要求准备 1080 × 1920 像素竖图，格式 PNG、JPG、JPEG 或 WEBP，文件不超过 10 MB。"
    "封面应呈现 AgentOS 桌面聊天界面和研究工作流，不要放入密钥、真实个人资料或尚未实现的 ESP32 连接画面。"
)

doc.add_heading("提交前核对清单", level=1)
checklist = [
    "确认作品名 AgentOS 和报名系统中的特别赛题/主赛道选项。",
    "确认特别赛题是否要求直接调用阿里云百炼；当前演示配置为 AIPing 转发的 Qwen 模型。",
    "填写团队与参赛人信息，并按比赛要求勾选参赛承诺。",
    "生成合规封面；完成 ZIP 时排除本机数据和凭据。",
    "在评审电脑上先安装运行，连接可用模型服务，再录制实际功能演示。",
    "演示中清楚区分已实现功能、基础 Windows 控件操作和未接入硬件。",
]
for item in checklist:
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.12)
    p.paragraph_format.first_line_indent = Inches(-0.12)
    p.paragraph_format.space_after = Pt(3)
    font(p.add_run("☐  " + item), 9.5, INK)

doc.add_heading("交付文件", level=1)
doc.add_paragraph("Windows 安装包：outputs/agentos/dist/AgentOS-Setup-0.1.0.exe")
doc.add_paragraph("项目源码与安装说明：outputs/agentos/README.md")
doc.add_paragraph("产品定义和后续工作：outputs/agentos/docs/产品定义与NewPulse参考.md")
doc.add_paragraph("AI 交接说明：outputs/agentos/docs/交接说明.md")

doc.core_properties.title = "AgentOS 作品交付文档"
doc.core_properties.subject = "AgentOS 竞赛报名与软件交付说明"
doc.core_properties.author = "AgentOS"
doc.save(OUT)
print(OUT)
