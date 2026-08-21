# Future Optimizations & Backlog

## App Size & Performance
- [ ] **Asset Compression**: Compress large media files (`finanimated.gif` - 13MB, `finanimated.mp4` - 4MB, `finwidget.png` - 2MB) to significantly reduce the final `.aab` / `.apk` bundle size and speed up app downloads from the Play Store.

## Maintenance
- [ ] Ensure `app_versions` on Supabase is updated to match local `app.json` versions *after* Google Play Store review finishes to trigger the in-app Update Warning Modal.
