## Aux Fileserver

This is a basic fileserver. It has a few useful features.

 * Supports uploads from browser
 * Password protected (separate upload and download passwords)
 * Session management (once logged in, you stay logged in)
 * Login is time-throttled for security
 * Public-accessible directory support
 * Fetches MP4 cover art from metadata for thumbnails
 * Responsive layout adapts to mobile devices
 * Can stream MP4 video to mobile devices

## Install

```sh
#install dependencies
npm install

#generate keys - when asked for a name, type the URL it will be served from
openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem

#create a configuration file.
#  Note the 3000 means wait 3 seconds after a bad
#  password before allowing a new one to be tried.
echo '{ "upPass": "YOUR-UPLOAD-PASSWORD", "dnPass": "YOUR-DOWNLOAD-PASSWORD", "sessionSalt": "randomCharacters", "login-throttle": 3000 }' >> config.json

#run the server
node main.js -p [YOUR-PORT]
```

## Trust the Keys
Make sure that once you have generated the "cert.pem" certificate file, you double click it in OSX or open it in iOS in order to add it to the list of trusted certificates. This will make the scary warning in browsers go away.

Note that this will only work if you have added the correct "name" to the certificate, which should be asked when you generate it with openssl. The name must be set to the URL from which it will be served, i.e.: mysite.com (no port is necessary).

## Screenshots

![desktop](/screenshots/desktop.png "Desktop") ![mobile](/screenshots/mobile.png "Mobile")
