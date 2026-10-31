param([Parameter(Mandatory=$true)][string]$Request)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$requestObject=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Request)) | ConvertFrom-Json
function Resolve-App($appId){
 $builtins=@{
  'builtin:notepad'=@{name='Notepad';path=(Join-Path $env:WINDIR 'System32/notepad.exe')}
  'builtin:calculator'=@{name='Calculator';path=(Join-Path $env:WINDIR 'System32/calc.exe')}
  'builtin:explorer'=@{name='File Explorer';path=(Join-Path $env:WINDIR 'explorer.exe')}
 }
 if($builtins.ContainsKey($appId)){return [pscustomobject]@{appId=$appId;name=$builtins[$appId].name;path=$builtins[$appId].path;registered=$false}}
 $found=Get-StartApps | Where-Object {$_.AppID -ceq $appId} | Select-Object -First 1
 if($null -eq $found){throw 'App ID not found. List available apps first.'}
 return [pscustomobject]@{appId=$found.AppID;name=$found.Name;path=$null;registered=$true}
}
if($requestObject.action -eq 'apps'){
 $query=[string]$requestObject.query
 $apps=@([pscustomobject]@{appId='builtin:notepad';name='Notepad'},[pscustomobject]@{appId='builtin:calculator';name='Calculator'},[pscustomobject]@{appId='builtin:explorer';name='File Explorer'})
 $registered=@(Get-StartApps | Where-Object {[string]::IsNullOrWhiteSpace($query) -or $_.Name.IndexOf($query,[StringComparison]::OrdinalIgnoreCase) -ge 0} | Select-Object -First 40 | ForEach-Object {[pscustomobject]@{appId=$_.AppID;name=$_.Name}})
 [pscustomobject]@{apps=@($apps)+@($registered);notice='Only lists registered application names and IDs. Pass an exact appId to launch.'} | ConvertTo-Json -Depth 5 -Compress;exit
}
if($requestObject.action -in @('resolve_app','launch')){
 $app=Resolve-App ([string]$requestObject.appId)
 if($requestObject.action -eq 'resolve_app'){[pscustomobject]@{appId=$app.appId;name=$app.name} | ConvertTo-Json -Compress;exit}
 if($app.registered){$shell=New-Object -ComObject Shell.Application;$shell.ShellExecute(('shell:AppsFolder\'+$app.appId),'','','open',1)}
 else{Start-Process -FilePath $app.path -WindowStyle Normal | Out-Null}
 [pscustomobject]@{action='launch';appId=$app.appId;name=$app.name;notice='Launch was requested. List windows and inspect the target to verify it opened.'} | ConvertTo-Json -Compress;exit
}
$rootElement=[Windows.Automation.AutomationElement]::RootElement
$treeWalker=[Windows.Automation.TreeWalker]::ControlViewWalker
function Runtime-Key($element){try{return ($element.GetRuntimeId() -join '.')}catch{return ''}}
function Describe-Control($element,$depth){
 try { $current=$element.Current; if($current.IsPassword){return}; [pscustomobject]@{id=(Runtime-Key $element);name=$current.Name;type=$current.ControlType.ProgrammaticName;automationId=$current.AutomationId;enabled=$current.IsEnabled;depth=$depth} } catch {}
}
function Collect-Controls($element,$depth,$list){
 if($depth -gt 5 -or $list.Count -ge 280){return}; $item=Describe-Control $element $depth; if($null -ne $item){$list.Add($item)}; $child=$treeWalker.GetFirstChild($element);while($null -ne $child -and $list.Count -lt 280){Collect-Controls $child ($depth+1) $list;$child=$treeWalker.GetNextSibling($child)}
}
if($requestObject.action -eq 'windows'){
 $windows=[Collections.Generic.List[object]]::new();$child=$treeWalker.GetFirstChild($rootElement);while($null -ne $child){try{$c=$child.Current;if($c.Name -and $c.ControlType.ProgrammaticName -eq 'ControlType.Window'){$windows.Add([pscustomobject]@{handle=$c.NativeWindowHandle;title=$c.Name;processId=$c.ProcessId})}}catch{};$child=$treeWalker.GetNextSibling($child)};ConvertTo-Json -InputObject @($windows.ToArray()) -Depth 5 -Compress;exit
}
if(!$requestObject.handle){throw '请先选择窗口'}
$window=[Windows.Automation.AutomationElement]::FromHandle([IntPtr][long]$requestObject.handle)
if($null -eq $window){throw '窗口不存在'}
if($requestObject.action -eq 'focus'){
 Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class AgentOSWindow { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n); }'
 $handle=[IntPtr][long]$requestObject.handle
 [void][AgentOSWindow]::ShowWindow($handle,9)
 [void][AgentOSWindow]::SetForegroundWindow($handle)
 $focused=[AgentOSWindow]::GetForegroundWindow() -eq $handle
 [pscustomobject]@{action='focus';focused=$focused;title=$window.Current.Name;notice='Inspect controls before further actions. If focused is false, Windows did not allow focus.'} | ConvertTo-Json -Compress;exit
}
if($requestObject.action -eq 'inspect'){$items=[Collections.Generic.List[object]]::new();Collect-Controls $window 0 $items;[pscustomobject]@{title=$window.Current.Name;controls=@($items.ToArray())} | ConvertTo-Json -Depth 7 -Compress;exit}
$all=$window.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
$target=$null;foreach($element in $all){if((Runtime-Key $element) -eq $requestObject.controlId){$target=$element;break}}
if($null -eq $target -or $target.Current.IsPassword){throw '控件不存在或不可操作，请重新读取窗口'}
if($requestObject.action -eq 'invoke'){$pattern=$target.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern);$pattern.Invoke()}
elseif($requestObject.action -eq 'set_value'){$pattern=$target.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern);$pattern.SetValue([string]$requestObject.value)}
else{throw '不支持的操作'}
[pscustomobject]@{ok=$true;action=$requestObject.action;control=$target.Current.Name;notice='动作已发出，请重新检查应用状态以确认任务结果。'} | ConvertTo-Json -Compress
