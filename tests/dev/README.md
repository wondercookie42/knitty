Dev harnesses (Playwright + local static server on /public). They expect the user's sample photos
in /mnt/user-data/attachments/... (not in the repo: copyrighted book pages). Edit the `dir` constant.
- one.js  '[{"f":"file.jpg","box":[x0,y0,x1,y1],"name":"x"}]'  mark a chart box (source pixels), read, print cells/groups
- all.js  upload each page whole and print whether it auto-reads (expected: MARK for full pages)
- rg.js   file.png  run Reader.analyze on an image (strict and lenient) and print metrics incl. hP/vP line peaks
