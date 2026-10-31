@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "AGENTOS_NODE=node"
if exist "D:\opne\node.exe" set "AGENTOS_NODE=D:\opne\node.exe"
echo AgentOS - 本地科研智能体
echo 请保持此窗口开启。浏览器会在服务就绪后打开。
"%AGENTOS_NODE%" tools/launch.mjs
pause
