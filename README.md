# AgentOS

最新产品定义：**通过自然语言直接操控电脑的小硬件，当前先实现电脑端软件。** 默认通过聊天下达目标。完整软件尚在建设中，具体进度及 NewPulse 参考见 [产品定义](docs/产品定义与NewPulse参考.md)。

面向 Qwen 科研提效方向的本地智能体软件。界面沿用 VeriFoundry 的森林绿、浅鼠尾草色、半透明导航与轻量过渡。项目独立运行，不改动 VeriFoundry 或 Nimo 的代码和数据。

## 打开

安装版：运行 `dist/AgentOS-Setup-0.1.0.exe`，然后从桌面或开始菜单打开 **AgentOS**。桌面程序会在自己的窗口内启动本地服务；关闭窗口时会一并停止由它启动的服务。

开发版：双击本目录的 **启动AgentOS.cmd**，会在浏览器中打开本地网页。也可以在安装开发依赖后运行 `npm run desktop`，在桌面窗口里使用。

在 Windows 上生成安装程序：

```powershell
npm install
npm run desktop:build
```

安装版将数据库、模型设置和项目资料保存在 Windows 用户数据目录 `AgentOS/data` 中，不写入安装目录；卸载时保留这些数据。开发版继续使用本项目下的 `data/`。两种运行方式的数据位置不同，目前不自动搬运。

默认端口为 4330；被其他程序占用时会尝试后续 20 个端口。同一数据目录重复启动时复用已有服务，不结束其他程序。以终端打印的地址为准。

也可以在本目录执行：

```powershell
npm start
```

开发网页版本需要 Node.js 24 或更新版本。安装版已包含桌面运行环境，不需要额外安装 Node.js。Python 路径会自动发现当前电脑的 Codex 运行环境，或使用系统 Python；也可以在软件设置中指定。内置实验仅使用 Python 标准库。PDF 提取另需 `pypdf`。

## 直接使用聊天框

默认打开聊天界面：输入消息并按 Enter，Shift + Enter 换行。可以接着上一轮继续说需求，最近 8 轮有结果的对话会带入模型上下文，历史对话保存在本机。

输入框左下角的 `+` 添加文件；右上角文件按钮下载成果，设置按钮管理已连接的模型和工具权限。执行代码或实际操作应用时，确认卡片直接显示在对话里。执行过程可展开查看，停止按钮位于输入框旁。

原来的详细管理页面保留在 `/?advanced=1#library`，也可从左侧底部的文件图标打开。

## 详细管理页

1. 打开“连接设置”，填写模型服务的 OpenAI 兼容地址、模型名称和对应服务的 API Key。支持 AIPing 和阿里云百炼；当前本机已配置 AIPing 的 `Qwen3-Coder-30B-A3B-Instruct`。
2. 保存设置。“保存并检查连接”会真实调用一次模型，产生少量 token 用量。
3. 默认回到聊天框，添加 PDF、CSV、Markdown 或代码文件，直接说出需求。
4. 查看研究任务的计划和执行记录；模型请求运行 Python 或操作 Windows 应用时，在任务里核对本次操作并选择批准或拒绝。
5. 在“资料与产物”查看、编辑、下载文件，或导出带 SHA-256 清单的研究空间 ZIP。

无需模型密钥也可以点击“先做一次本地实验”。它实际运行 Python，对比全局 Z-score 与滚动 MAD，并生成输入数据、预测 CSV、指标 JSON、SVG 图表、报告、执行日志和复现程序。默认数据明确标注为合成数据。导入自己的 CSV 时必须有数值 `value` 列，可选二值 `label` 列；无标签不计算准确性指标。

示例研究目标：

> 先列出我的资料，阅读 inputs 中的研究材料。整理研究问题和已有证据，给出三步计划，再分析 CSV 的缺失值和异常值。把来源、数据处理方法与局限写入报告；执行脚本前让我确认。

## 已实现能力

- 独立研究空间、SQLite 持久化、重启恢复与中断标记。
- Qwen 兼容对话和 Function Calling，最多 20 轮，逐次保存模型调用元数据和真实工具结果。
- 空间内文本文件读写、旧版本留存、文件上传下载、PDF 文字提取。
- Crossref 文献元数据检索、公开网页阅读与来源保存；元数据不被当作已读全文。
- 可批准的本机 Python 执行、超时停止、脚本及输出日志保存。
- 单独的研究浏览器：公共页面阅读、截图、控件读取、点击和填写；不继承用户登录，阻止非 GET/HEAD 请求。
- Windows UI Automation 适配：窗口和控件读取、按钮调用、文本输入。默认关闭，点击和填写逐次确认；密码控件不读取或填写。
- 真实基线对照实验与复现材料。
- 响应式布局、键盘焦点反馈、轻量页面淡入、减少动态效果偏好支持。

## 能力边界

- 已使用用户授权的 AIPing 凭据获得真实 Qwen 回复。AIPing 接口地址为 `https://aiping.cn/api/v1`，底层模型为 `Qwen3-Coder-30B-A3B-Instruct`；这是 AIPing 转发的模型服务，并非直连百炼。此前 VeriFoundry 的 DeepSeek 凭据没有迁移到这里。
- Windows 应用控制依赖目标程序提供可访问控件。当前未进行真实第三方应用端到端操作验证；不承诺任意软件、任意屏幕操作。
- 本地 Python 拥有当前用户权限，**不是操作系统沙箱**。请逐次核对模型提出的代码。工具文件路径检查只约束直接文件工具，不能隔离已批准 Python 的系统权限。
- 研究浏览器不支持账号登录、外部提交、付款、发送消息或其他外部写入；公共 GET 网页也应按研究目的选择。它不是一个完整的浏览器安全隔离产品。
- PDF 最多提取前 40 页，无扫描件 OCR；较长工具输出会截断。
- 内置实验只比较两种固定参数基线。合成数据成绩不代表真实设备表现，也不构成普遍算法优势。
- **ESP32 当前完全未启用**：没有串口连接、BLE、扫描、烧录或硬件实测。设备 API 只返回未连接状态，写入入口拒绝执行。
- 当前提供 Windows 桌面窗口和 NSIS 安装构建方式，核心仍由本机 Node 后台服务执行。它不是新的操作系统内核，也不具备无人值守控制全部电脑的能力。

## 数据与配置

```text
data/agentos.sqlite           项目、任务、事件、文件修订元数据
data/settings.json           本机配置及模型凭据（本地明文，勿分享）
data/workspaces/<project-id>/ 实际研究文件和实验输出
data/instance.json           当前服务进程与实际端口
```

分享源码或比赛提交时不包含 `data/`、`.env`、模型密钥和私人材料。ZIP 导出包含当前研究空间文件，不含应用配置和模型密钥；任务执行记录以 `runs/*-record.json` 保存，异常实验以自身日志保存。停止服务后备份整个 `data/` 可迁移完整任务历史。

`.env.example` 可复制为 `.env` 配置初始值。软件内保存的设置优先于环境变量。更换模型服务域名会清除旧域名凭据，避免误发。

可选浏览器组件缺失时执行 `npm run install:browser`。当前开发电脑可复用相邻 VeriFoundry 已安装的 Playwright；复制到其他电脑时应安装独立组件。

## 文件结构与交接

```text
public/index.html                 页面入口
public/assets/app.mjs             六个页面、路由、任务/文件/设置交互
public/assets/style.css           VeriFoundry 风格与响应式样式
src/server.mjs                    本机 HTTP API、鉴权、端口与实例管理
src/core.mjs                      数据、工作空间、文件和配置
src/model.mjs                     Qwen 模型调用
src/agent.mjs                     工具执行循环、审批和任务状态
src/tools.mjs                     注册工具
src/runtime.mjs                   Python 与 Windows 适配
src/web.mjs                       资料检索和研究浏览器
src/experiment.mjs                内置实验调度
src/zip.mjs                       ZIP 与哈希清单
tools/experiment.py               可复现基线实验
tools/desktop.ps1                 Windows UI Automation 桥接
tools/launch.mjs                  可重复启动的启动器
docs/交接说明.md                   当前进度与后续工作
```

参考的官方能力与开源项目：

- [百炼 OpenAI 兼容接口](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)
- [Qwen Function Calling](https://help.aliyun.com/zh/model-studio/qwen-function-calling)
- [AIPing API Key 与兼容接口](https://aiping.cn/docs/API/API-Key)、[AIPing 工具调用](https://aiping.cn/docs/Features/function-call)
- [Qwen-Agent](https://github.com/QwenLM/Qwen-Agent)：参考工具执行思想，当前没有复制或集成其源码。
- [Qwen open-computer-use](https://github.com/QwenLM/open-computer-use)：后续桌面能力扩展参考，未安装。
- [Microsoft UFO](https://github.com/microsoft/UFO)：已有 AgentOS 相关工作，比赛中不声称首次发明 AgentOS。

当前本地应用未部署到外网，不提供多用户隔离、远程访问或生产级权限系统。
