# Piper iPhone icon refresh
This release changes both the manifest URL and every installed-icon filename to new, never-before-used URLs.
Current iPhone Apple Touch Icon:
public/icons/piper-touch-cream-20261108-2358.png
Current manifest:
public/manifest-20261108-2358.webmanifest

After GitHub Pages deploy is green:
1. Open https://bknavarre.github.io/Piper/ in Safari once.
2. Confirm the web app itself is current.
3. Delete the OLD Piper Home Screen icon.
4. Wait about 10 seconds.
5. In Safari use Share > Add to Home Screen.

An already-installed iOS web clip can retain its installation icon; web code cannot force-replace Apple's stored icon in place. New filenames make a fresh Add to Home Screen install request the approved current cream icon.
