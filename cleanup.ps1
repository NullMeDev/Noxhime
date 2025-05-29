# Noxhime Bot - Windows Cleanup Script
# This script removes unnecessary files from the Noxhime bot project

Write-Host "Noxhime Bot - Windows Cleanup Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: This script must be run from the root of the Noxhime bot directory" -ForegroundColor Red
    exit 1
}

# Files to remove
$filesToRemove = @(
    "get-docker.sh",
    "install-noxhime.sh",
    "noxhime-installer.sh",
    "quick-setup.sh",
    "unified-install.sh"
)

# Remove unnecessary installation scripts
Write-Host "Removing unnecessary installation scripts..." -ForegroundColor Yellow
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "  Removed: $file" -ForegroundColor Green
    } else {
        Write-Host "  Not found: $file" -ForegroundColor Gray
    }
}

# Check if docker-compose.yml should be removed
if (Test-Path "docker-compose.yml") {
    $removeDocker = Read-Host "Do you want to remove docker-compose.yml? (y/N)"
    if ($removeDocker -eq "y" -or $removeDocker -eq "Y") {
        Remove-Item "docker-compose.yml" -Force
        Write-Host "  Removed: docker-compose.yml" -ForegroundColor Green
    } else {
        Write-Host "  Kept: docker-compose.yml" -ForegroundColor Yellow
    }
}

# Update package.json to remove test-alert script
if (Test-Path "package.json") {
    Write-Host "Updating package.json..." -ForegroundColor Yellow
    
    try {
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        
        # Check if test-alert script exists
        if ($packageJson.scripts.PSObject.Properties.Name -contains "test-alert") {
            # Create a new scripts object without test-alert
            $newScripts = New-Object PSObject
            foreach ($prop in $packageJson.scripts.PSObject.Properties) {
                if ($prop.Name -ne "test-alert") {
                    $newScripts | Add-Member -MemberType NoteProperty -Name $prop.Name -Value $prop.Value
                }
            }
            
            # Replace the scripts object
            $packageJson.scripts = $newScripts
            
            # Save the updated package.json
            $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
            Write-Host "  Removed test-alert script from package.json" -ForegroundColor Green
        } else {
            Write-Host "  No test-alert script found in package.json" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Error updating package.json: $_" -ForegroundColor Red
    }
}

# Add Node.js 18.x requirement to package.json if not already present
if (Test-Path "package.json") {
    Write-Host "Checking Node.js version requirement..." -ForegroundColor Yellow
    
    try {
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        
        # Check if engines field exists and has the right Node.js version
        $addEngines = $false
        if (-not ($packageJson.PSObject.Properties.Name -contains "engines")) {
            $addEngines = $true
        } elseif (-not ($packageJson.engines.PSObject.Properties.Name -contains "node") -or $packageJson.engines.node -ne "18.x") {
            $addEngines = $true
        }
        
        if ($addEngines) {
            # Add or update engines field
            $engines = New-Object PSObject
            $engines | Add-Member -MemberType NoteProperty -Name "node" -Value "18.x"
            $packageJson | Add-Member -MemberType NoteProperty -Name "engines" -Value $engines -Force
            
            # Save the updated package.json
            $packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
            Write-Host "  Added Node.js 18.x requirement to package.json" -ForegroundColor Green
        } else {
            Write-Host "  Node.js 18.x requirement already present in package.json" -ForegroundColor Gray
        }
    } catch {
        Write-Host "  Error updating Node.js version in package.json: $_" -ForegroundColor Red
    }
}

# Check for OAuth related code
Write-Host "Checking for OAuth related code..." -ForegroundColor Yellow
$oauthFiles = Get-ChildItem -Recurse -Include "*.ts", "*.js" | Where-Object { (Get-Content $_ -Raw) -match "oauth" }

if ($oauthFiles) {
    Write-Host "  Found potential OAuth references in these files:" -ForegroundColor Yellow
    foreach ($file in $oauthFiles) {
        Write-Host "    $($file.FullName)" -ForegroundColor Yellow
    }
    Write-Host "  Please review these files manually to remove any OAuth related code" -ForegroundColor Yellow
} else {
    Write-Host "  No OAuth related code found" -ForegroundColor Green
}

# Summary
Write-Host
Write-Host "Cleanup completed!" -ForegroundColor Green
Write-Host
Write-Host "For a complete optimization of the project for Ubuntu 24.04:" -ForegroundColor Yellow
Write-Host "1. Use the install-ubuntu24.sh script for installation" -ForegroundColor Yellow
Write-Host "2. Use the cleanup.sh script after installation" -ForegroundColor Yellow
Write-Host
Write-Host "These scripts will ensure proper Node.js 18.x compatibility and optimize the bot" -ForegroundColor Yellow
Write-Host "for production use on Ubuntu 24.04 systems." -ForegroundColor Yellow

