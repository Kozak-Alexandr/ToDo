!include "MUI2.nsh"

; Define the section for "Start with Windows"
Section "Start with Windows" SecAutoStart
  SetShellVarContext current
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "AODTasks" "$INSTDIR\Always-on-tasks.exe"
SectionEnd

; Delete the registry key on uninstall
Section "Uninstall"
  SetShellVarContext current
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "AODTasks"
SectionEnd
