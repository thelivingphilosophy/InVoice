# Tradesman App - Build Instructions for Sideloading

## Prerequisites ✅
- [x] Pushed to GitHub
- [x] Logged into EAS CLI
- [x] EAS configuration files created

## Next Steps

### 1. Login to EAS CLI (if not already done)
```bash
eas login
```

### 2. Update app.json owner field
Edit `app.json` and replace `"your-username"` with your actual Expo username/organization name.

### 3. Build APK for sideloading
```bash
eas build --platform android --profile preview
```

This will:
- Build an APK file (not AAB, so it can be sideloaded)
- Use the "preview" profile which creates internal distribution builds
- Take about 10-15 minutes to complete

### 4. Download the APK
Once the build completes, EAS will provide a download link for the APK file.

### 5. Sideload the APK
Transfer the APK to your Android device and install it:
- Enable "Install from Unknown Sources" in Android settings
- Transfer APK via USB, email, or cloud storage
- Tap the APK file to install

## Configuration Files Created

### `eas.json`
- **preview profile**: Builds APK for sideloading
- **production profile**: Builds AAB for Play Store (future use)

### `app.json` updates
- Added Android permissions for audio recording
- Set proper package name: `com.tradesmanapp.voice`
- Added version code for Android builds

## Build Profiles

- **preview**: Creates APK for sideloading/testing
- **production**: Creates AAB for Play Store submission
- **development**: Creates development builds with debugging

## Troubleshooting

If build fails:
1. Check that all dependencies are properly installed
2. Ensure your Expo account has build credits
3. Verify the owner field in app.json matches your account

## Build Commands Reference

### Start a build
```bash
eas build --platform android --profile preview
```

### Check build status
```bash
eas build:list
```

### View specific build details
```bash
eas build:view [BUILD_ID]
```

### Cancel a running build
```bash
eas build:cancel [BUILD_ID]
```

## Important Notes

- **Owner field**: You MUST update the `owner` field in `app.json` with your actual Expo username
- **Build time**: Expect 10-15 minutes for the build to complete
- **Credits**: Free Expo accounts get limited build credits per month
- **APK size**: The final APK will be around 40-60MB

## Ready to Build!
Your project is now configured for EAS Build. Run the build command when ready!