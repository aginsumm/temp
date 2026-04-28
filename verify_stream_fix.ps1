# 快速验证脚本

Write-Host "验证后端修改..." -ForegroundColor Cyan
$backend_file = "backend\app\api\v1\chat.py"
$content = Get-Content $backend_file -Raw

if ($content -like '*yield "data: [DONE]"*') {
    Write-Host "[DONE] 标记已添加" -ForegroundColor Green
} else {
    Write-Host "[DONE] 标记未添加" -ForegroundColor Red
}

if ($content -like '*yield "data: [DONE]"*return*') {
    Write-Host "显式 return 已添加" -ForegroundColor Green
} else {
    Write-Host "显式 return 未添加" -ForegroundColor Red
}

Write-Host "`n验证前端修改..." -ForegroundColor Cyan
$frontend_file = "frontend\src\data\repositories\chatRepository.ts"
$frontend_content = Get-Content $frontend_file -Raw

if ($frontend_content -like '*ACTIVITY_TIMEOUT = 10000*') {
    Write-Host "ACTIVITY_TIMEOUT 已优化 (10s)" -ForegroundColor Green
} else {
    Write-Host "ACTIVITY_TIMEOUT 未优化" -ForegroundColor Red
}

if ($frontend_content -like '*READ_TIMEOUT = 5000*') {
    Write-Host "READ_TIMEOUT 已优化 (5s)" -ForegroundColor Green
} else {
    Write-Host "READ_TIMEOUT 未优化" -ForegroundColor Red
}

Write-Host "`n验证完成！" -ForegroundColor Cyan
