# Salva uma chave do Supabase no .env.local sem mostrar a chave na tela.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\colar-chave.ps1 secreta
#       powershell -ExecutionPolicy Bypass -File scripts\colar-chave.ps1 publica
param([Parameter(Mandatory)][ValidateSet("publica", "secreta")][string]$tipo)

$arquivo = Join-Path $PSScriptRoot "..\.env.local"
$variavel, $prefixo = if ($tipo -eq "publica") {
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_"
} else {
  "SUPABASE_SERVICE_ROLE_KEY", "sb_secret_"
}

Write-Host ""
Write-Host "1) No Supabase, clique no botao de copiar da chave $tipo." -ForegroundColor Cyan
Write-Host "2) Volte aqui, clique com o botao DIREITO do mouse para colar e aperte Enter." -ForegroundColor Cyan
Write-Host "   (a chave nao aparece enquanto voce cola - e normal)" -ForegroundColor DarkGray
$seguro = Read-Host "Chave $tipo" -AsSecureString
$chave = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)).Trim()

if (-not $chave.StartsWith($prefixo)) {
  Write-Host "Isso nao parece a chave $tipo (ela deve comecar com $prefixo). Nada foi salvo; rode o comando de novo." -ForegroundColor Red
  exit 1
}

$linhas = [IO.File]::ReadAllLines($arquivo) | ForEach-Object {
  if ($_ -match "^$variavel=") { "$variavel=$chave" } else { $_ }
}
[IO.File]::WriteAllLines($arquivo, $linhas)

Write-Host "Pronto! Chave $tipo salva no .env.local (termina em ...$($chave.Substring($chave.Length - 4)))." -ForegroundColor Green