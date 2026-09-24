cd Backend
npm start

npm --prefix Backend start
Get-NetTCPConnection -LocalPort 3000 -State Listen |
Select-Object -ExpandProperty OwningProcess -Unique |
ForEach-Object { Stop-Process -Id $_ -Force }
npm start