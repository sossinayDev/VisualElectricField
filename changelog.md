## VisualElectricField v0.5

Bug fixes:
- Fixed arrow rendering
- Fixed unit inconsistency
- Fixed charge calculation
- Fixed simluation state messages

Removals:
- Removed rigidbody button
- Removed simulation panel

Additions:
- Loading splash screen
    - Gray overlay until loading icon loaded
    - Spinning loading icon
    - Loading state information text
    - Hints/Splash texts
- Added indicators
    - FPS indicator
    - Indicator when using tape measure or pinpoint
    - Indicator when placing a charge
    - Charge indicator when hovering over charge
- Added camera reset button (Home)
- Added tape measure tool
- Added pinpoint tool
- Added object selection
- Added inspector:
    - View parameters
    - Delete object
- Added undo/redo-history and keybinds
- Added automatic saving in localStorage
- Added automatic simulation loading
    - When simulation code in link (#{code})
    - When local simulation is found
- Added non-native popups
- Added big share popup
    - Displays code (for better viewing/classrooms)
    - Has links for copying code or link (with hash)
- Added grid snap on shift for non-charge objects
- Added placement preview (shows the position where the new object is placed)
- Added sensors (they display field strength at their positions)
- Added text mentioning the simulation is to scale
- Added keypress handler for escape.
- Implemented unit consistency
- Implemented pixel-to-meters conversion

Updates/Reworks:
- Updated version code
- Reworked angle function
- Reworked rendering function to approximate straight lines
- Charge can now be set using Coulomb
- Changed icons for upload/download buttons.