!macro customInstall
  ${If} ${FileExists} "$INSTDIR\resources\app-icon.ico"
    ${If} ${FileExists} "$newStartMenuLink"
      Delete "$newStartMenuLink"
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\app-icon.ico" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${EndIf}

    ${If} ${FileExists} "$newDesktopLink"
      Delete "$newDesktopLink"
      CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\app-icon.ico" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ${if} ${isUpdated}
    # Do not prompt during update-driven uninstall flows.
  ${else}
    ${IfNot} ${Silent}
      MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 \
        "Do you want to remove BudgetIT settings and local database files?$\r$\n$\r$\nChoose No to keep them for reinstall." \
        IDYES removeAppData IDNO keepAppData
    ${Else}
      Goto keepAppData
    ${EndIf}

    removeAppData:
      # Electron stores user data in per-user AppData locations.
      ${if} $installMode == "all"
        SetShellVarContext current
      ${endif}
      RMDir /r "$APPDATA\${APP_FILENAME}"
      !ifdef APP_PRODUCT_FILENAME
        RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
      !endif
      !ifdef APP_PACKAGE_NAME
        RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
      !endif
      ${if} $installMode == "all"
        SetShellVarContext all
      ${endif}
      Goto uninstallPromptDone

    keepAppData:
      DetailPrint "Keeping BudgetIT settings and database files."

    uninstallPromptDone:
  ${endif}
!macroend
