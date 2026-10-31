param([Parameter(Mandatory=$true)][string]$Request,[string]$Output='')
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AgentOSScreenNative {
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
 public static void Wheel(int amount){ mouse_event(0x0800,0,0,unchecked((uint)(-amount*120)),UIntPtr.Zero); }
}
'@
[void][AgentOSScreenNative]::SetProcessDPIAware()
$req=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Request)) | ConvertFrom-Json
$action=[string]$req.action
$b=[System.Windows.Forms.SystemInformation]::VirtualScreen
$ox=$b.X; $oy=$b.Y; $sw=$b.Width; $sh=$b.Height
function ToPx([double]$nx,[double]$ny){ return @([int][Math]::Round($ox+($nx/1000.0)*$sw),[int][Math]::Round($oy+($ny/1000.0)*$sh)) }
$LEFTDOWN=0x0002; $LEFTUP=0x0004; $RIGHTDOWN=0x0008; $RIGHTUP=0x0010; $MIDDLEDOWN=0x0020; $MIDDLEUP=0x0040
function Mouse-Button([string]$button,[bool]$down){
 $b2=$button; if(-not $b2){$b2='left'}
 if($down){ if($b2 -eq 'right'){$f=$RIGHTDOWN}elseif($b2 -eq 'middle'){$f=$MIDDLEDOWN}else{$f=$LEFTDOWN} }
 else{ if($b2 -eq 'right'){$f=$RIGHTUP}elseif($b2 -eq 'middle'){$f=$MIDDLEUP}else{$f=$LEFTUP} }
 [void][AgentOSScreenNative]::mouse_event([uint32]$f,0,0,0,[UIntPtr]::Zero)
}
if($action -eq 'capture'){
 if([string]::IsNullOrWhiteSpace($Output)){throw '缺少截图输出路径'}
 $capX=$ox; $capY=$oy; $capW=$sw; $capH=$sh
 if($req.handle){
  Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class AgentOSWinRect { [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); public struct RECT { public int Left, Top, Right, Bottom; } }'
  $target=[IntPtr][long]$req.handle
  [void][AgentOSWinRect]::ShowWindow($target,9)
  [void][AgentOSWinRect]::SetForegroundWindow($target)
  Start-Sleep -Milliseconds 350
  $rect=New-Object AgentOSWinRect+RECT
  if([AgentOSWinRect]::GetWindowRect($target,[ref]$rect)){ if($rect.Right -gt $rect.Left -and $rect.Bottom -gt $rect.Top){ $capX=$rect.Left; $capY=$rect.Top; $capW=$rect.Right-$rect.Left; $capH=$rect.Bottom-$rect.Top } }
  if($capW -lt 200 -or $capH -lt 120){ $capX=$ox; $capY=$oy; $capW=$sw; $capH=$sh }
 }
 $bmp=New-Object System.Drawing.Bitmap $capW,$capH
 if($null -eq $bmp){throw '无法创建截图位图'}
 $g=[System.Drawing.Graphics]::FromImage($bmp)
 $g.CopyFromScreen($capX,$capY,0,0,$bmp.Size)
 $g.Dispose()
 $iw=$capW; $ih=$capH
 if($capW -gt 1280){ $scale=1280.0/[double]$capW; $iw=1280; $ih=[int][Math]::Round($capH*$scale); $small=New-Object System.Drawing.Bitmap $iw,$ih; $g2=[System.Drawing.Graphics]::FromImage($small); $g2.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $g2.DrawImage($bmp,0,0,$iw,$ih); $g2.Dispose(); $bmp.Dispose(); $bmp=$small }
 $bmp.Save($Output,[System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
 [pscustomobject]@{ok=$true;action='capture';path=$Output;width=$iw;height=$ih;screenWidth=$sw;screenHeight=$sh;originX=$ox;originY=$oy;windowHandle=if($req.handle){[long]$req.handle}else{$null}} | ConvertTo-Json -Compress
 exit
}
if($action -eq 'click'){
 $p=ToPx ([double]$req.x) ([double]$req.y)
 [void][AgentOSScreenNative]::SetCursorPos($p[0],$p[1]); Start-Sleep -Milliseconds 80
 $button=[string]$req.button
 Mouse-Button $button $true; Start-Sleep -Milliseconds 60; Mouse-Button $button $false; Start-Sleep -Milliseconds 120
 if($req.double){ Mouse-Button $button $true; Start-Sleep -Milliseconds 60; Mouse-Button $button $false; Start-Sleep -Milliseconds 150 }
 [pscustomobject]@{ok=$true;action='click';x=$p[0];y=$p[1];button=$button;double=[bool]$req.double} | ConvertTo-Json -Compress
 exit
}
if($action -eq 'drag'){
 $p1=ToPx ([double]$req.x1) ([double]$req.y1); $p2=ToPx ([double]$req.x2) ([double]$req.y2)
 [void][AgentOSScreenNative]::SetCursorPos($p1[0],$p1[1]); Start-Sleep -Milliseconds 100
 Mouse-Button 'left' $true; Start-Sleep -Milliseconds 100
 [void][AgentOSScreenNative]::SetCursorPos($p2[0],$p2[1]); Start-Sleep -Milliseconds 150
 Mouse-Button 'left' $false; Start-Sleep -Milliseconds 150
 [pscustomobject]@{ok=$true;action='drag';fromX=$p1[0];fromY=$p1[1];toX=$p2[0];toY=$p2[1]} | ConvertTo-Json -Compress
 exit
}
if($action -eq 'type'){
 $text=[string]$req.text
 if([string]::IsNullOrEmpty($text)){throw '没有要输入的文本'}
 $old=$null; try{$old=Get-Clipboard -Raw -ErrorAction SilentlyContinue}catch{}
 Set-Clipboard -Value $text; Start-Sleep -Milliseconds 80
 [System.Windows.Forms.SendKeys]::SendWait('^v'); Start-Sleep -Milliseconds 200
 if($null -ne $old){ try{Set-Clipboard -Value $old}catch{} }
 [pscustomobject]@{ok=$true;action='type';length=$text.Length} | ConvertTo-Json -Compress
 exit
}
if($action -eq 'key'){
 $keys=[string]$req.keys
 if([string]::IsNullOrEmpty($keys)){throw '没有按键组合'}
 [System.Windows.Forms.SendKeys]::SendWait($keys); Start-Sleep -Milliseconds 150
 [pscustomobject]@{ok=$true;action='key';keys=$keys} | ConvertTo-Json -Compress
 exit
}
if($action -eq 'scroll'){
 $amount=[int]$req.amount
 [AgentOSScreenNative]::Wheel($amount); Start-Sleep -Milliseconds 150
 [pscustomobject]@{ok=$true;action='scroll';amount=$amount} | ConvertTo-Json -Compress
 exit
}
throw ('不支持的操作：'+$action)
