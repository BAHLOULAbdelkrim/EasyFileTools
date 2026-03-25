High-Tech Hugo theme (example site)
----------------------------------

Structure:
 - config.toml at site root
 - themes/high-tech-theme : theme files (layouts, static assets)
 - content/ : sample sections, submenus and articles
 - static/images : placeholder images (logo, slides, menu images, article images)

Usage:
 - unzip the provided archive.
 - cd into the unzipped folder and run `hugo server` (requires Hugo installed).
 - The site uses the theme `high-tech-theme` defined in config.toml.

Notes:
 - Menu and submenu colors, hover invert + shine effect implemented with CSS.
 - Hero switches to the section's `menu_image` when visiting a section or one of its subpages.
 - The mobile view collapses the top and left menus into a burger menu.

