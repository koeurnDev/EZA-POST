param (
    [string]$InputFile,
    [string]$OutputFile
)

$InputFile = Resolve-Path $InputFile
$Extension = [System.IO.Path]::GetExtension($InputFile).ToLower()

try {
    # 1. DOCX -> PPTX (via PowerPoint)
    if (($Extension -in @(".docx", ".doc")) -and ($OutputFile -match "\.pptx$")) {
        $ppt = New-Object -ComObject PowerPoint.Application
        # $ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue 
        
        # Open DOCX as Outline
        $presentation = $ppt.Presentations.Open($InputFile)
        # Format 24 = ppSaveAsOpenXMLPresentation
        $presentation.SaveAs($OutputFile, 24)
        $presentation.Close()
        
        $ppt.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
    }
    # 2. DOCX -> PDF (via Word)
    elseif ($Extension -in @(".docx", ".doc")) {
        $word = New-Object -ComObject Word.Application
        $word.DisplayAlerts = 0 # wdAlertsNone
        $word.Visible = $false
        
        $doc = $word.Documents.Open($InputFile)
        # Format 17 = wdFormatPDF
        $doc.SaveAs([ref]$OutputFile, [ref]17)
        $doc.Close([ref]$false)
        
        $word.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    # 3. PPTX -> PDF (via PowerPoint)
    elseif ($Extension -in @(".pptx", ".ppt")) {
        $ppt = New-Object -ComObject PowerPoint.Application
        # $ppt.Visible = [Microsoft.Office.Core.MsoTriState]::msoTrue 
        
        $presentation = $ppt.Presentations.Open($InputFile, 0, 0, 0)
        # Format 32 = ppSaveAsPDF
        $presentation.SaveAs($OutputFile, 32)
        $presentation.Close()
        
        $ppt.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
    }
    # 4. PDF -> DOCX (via Word - Fallback if Python not used)
    elseif ($Extension -eq ".pdf") {
        $word = New-Object -ComObject Word.Application
        $word.DisplayAlerts = 0 # wdAlertsNone
        $word.Visible = $false
        
        $doc = $word.Documents.Open($InputFile, $false, $true) 
        # Format 16 = wdFormatXMLDocument (DOCX)
        $doc.SaveAs([ref]$OutputFile, [ref]16)
        $doc.Close([ref]$false)
        
        $word.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    else {
        Write-Error "Unsupported file type or conversion combo: $Extension to $OutputFile"
        exit 1
    }
    
    if (Test-Path $OutputFile) {
        Write-Host "Success: $OutputFile"
    }
    else {
        Write-Error "Failed to create PDF"
        exit 1
    }

}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
