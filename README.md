# SOEN-390-MakeSoft
Mini-Capstone.

## For Backend

### Instructions
1. Open a new terminal.
2. Naviagte to the <i>backend-api</i> directory.
3. Run <code>mvn clean install</code> in order to install required dependencies.
4. Run <code>mvn spring-boot:run</code> in order to boot-up the backend.

### Database (Neon PostgreSQL)

The backend uses **PostgreSQL** (e.g. [Neon](https://neon.tech)). Configure the connection with environment variables.

#### 1. Copy the example env file and add your credentials:sh\
`cp backend-api/.env.example backend-api/.env`

#### 2. Edit `backend-api/.env` and set:
* DATABASE_URL – JDBC URL (e.g. from Neon: `jdbc:postgresql://HOST/DATABASE?sslmode=require`)
* DATABASE_USERNAME – database user
* DATABASE_PASSWORD – database password

#### 3. Spring Boot reads these when you run the app.\
To use .env from the shell, you can run:\
```
   cd backend-api
   export $(cat .env | xargs)
   mvn spring-boot:run
```
Or set the variables in your IDE/run configuration.


### Technologies Used
- <b>Spring Boot</b> – Chosen for its ease of use and developer productivity. Built on top of Spring, it provides a solid infrastructure for building scalable and maintainable applications.
- <b>Maven</b> – Used as the build tool to simplify dependency management, automate tasks, and streamline the process of running the backend.
- <b>PostgreSQL</b> – The application database (hosted on [Neon](https://neon.tech)). Used for persistent storage and configured via environment variables.
- <b>Spring Data JPA</b> – Used for data access and object–relational mapping with the PostgreSQL database.

## For Frontend

### Instructions
1. Open a new terminal.
2. Run <code>cd mobile-app</code>.
3. Run <code>npm install</code> to install required dependencies.
4. Run <code>npm run ios</code> to launch the app on the iOS Simulator.
5. Run <code>npm run android</code> to launch the app on the Android Emulator.

### Technologies Used
- <b>React Native (Expo)</b> – Used to build the mobile app for both iOS and Android.
- <b>Expo Router</b> – Handles navigation and screen structure.
- <b>TypeScript</b> – Improves code safety and helps catch errors and keep the code easier to maintain.

## Running the App on a Physical Phone (LAN)

The mobile app can be tested on a **physical phone** using a **trusted local network** (home Wi-Fi or personal hotspot).  
Do **not** use campus or public Wi-Fi for LAN testing.

### Prerequisites (Phone)
Install **Expo Go** on your phone:
- iOS: App Store
- Android: Google Play Store

Expo Go is required to load and run the development build on a physical device.

### Network Requirements
Both your **laptop and phone** must be connected to the **same trusted network**:
- Home Private Wi-Fi, or
- Your phone’s personal hotspot

Public networks (e.g. campus, café or school Wi-Fi) are unsafe for LAN testing because they are shared with untrusted devices. If you open up ports on a public network someone else could hit the endpoints.

### Step 1: Connect to the Same Network
- Connect your phone and laptop to the same home Wi-Fi, **or**
- Enable your phone’s hotspot and connect your laptop to it

### Step 2: Find Your Laptop’s Local IP Address

**Windows**

```powershell
ipconfig
```

Look for the **IPv4 Address** of the active network

**macOS / Linux**

```bash
ifconfig
```

### Step 3: Configure Environment Variables

Create a file named `.env.local` in the `mobile-app` directory.

Add the following content to the file:

```env
REACT_NATIVE_PACKAGER_HOSTNAME=YOUR_IP_ADDRESS
```

Replace `YOUR_IP_ADDRESS` with the IPv4 address found in Step 2.


### Step 4: Start the Backend

From the `backend-api` directory, run:

```bash
mvn spring-boot:run
```

Ensure the backend is running on port `8080`.

### Step 5: Start the Mobile App

From the `mobile-app` directory, run:

```bash
npm install
npm run start:lan
```

Wait for the QR code to appear in the terminal.


### Step 6: Open the App on Your Phone

1. Open the Camera App on iPhone or open **Expo Go** on your Android phone  
2. Scan the QR code shown in the terminal  
3. The app should load and connect to the local backend  

### Notes

- This was only tested on iPhone + Windows OS.
- Ensure your network is marked as **Private** on your computer for security purposes 
- Restart Expo after modifying `.env.local`  
- If LAN does not work on home Wi-Fi, try using your **phone hotspot**


### Security Note

LAN testing is intended for **trusted networks only**.  
Do **not** open firewall ports or enable inbound access on public networks.

