import bcrypt from "bcryptjs";

const hashFromDB = "$2b$10$Uj8l.9yvNIxpXUjmJg7ceuhtzZTWvJQDm4481kglZQpHKTuJ0X/2y"; // paste DB hash here

const passwords = [
  "baseball",
  "Baseball",
  "amit_Shrestha",
  "Amit_Shrestha",
  "AMIT_SHRESTHA",

  "amitshrestha",
  "AmitShrestha",
  "amit.shrestha",
  "amit-shrestha",
  "amit@shrestha",

  // Missing one character
  "mit_shrestha",
  "ait_shrestha",
  "amt_shrestha",
  "ami_shrestha",
  "amitshrestha",
  "amit_srestha",
  "amit_hrestha",
  "amit_shestha",
  "amit_shrtha",
  "amit_shresha",
  "amit_shresta",
  "amit_shresth",

  // Double characters
  "aamit_shrestha",
  "ammit_shrestha",
  "amiit_shrestha",
  "amitt_shrestha",
  "amit__shrestha",
  "amit_shhrestha",
  "amit_shresthaa",

  // Numbers at end
  "amit_shrestha1",
  "amit_shrestha12",
  "amit_shrestha123",
  "amit_shrestha1234",
  "amit_shrestha007",
  "amit_shrestha786",
  "amit_shrestha111",
  "amit_shrestha000",
  "amit_shrestha999",
  "amit_shrestha2020",
  "amit_shrestha2021",
  "amit_shrestha2022",
  "amit_shrestha2023",
  "amit_shrestha2024",
  "amit_shrestha2025",
  "amit_shrestha2026",

  // Numbers at start
  "1amit_shrestha",
  "123amit_shrestha",
  "786amit_shrestha",
  "2024amit_shrestha",

  // Special characters end
  "amit_shrestha!",
  "amit_shrestha@",
  "amit_shrestha#",
  "amit_shrestha$",
  "amit_shrestha%",
  "amit_shrestha^",

  // Special characters start
  "!amit_shrestha",
  "@amit_shrestha",
  "#amit_shrestha",

  // Replace letters (leet)
  "am1t_shrestha",
  "am!t_shrestha",
  "@mit_shrestha",
  "amit_$hrestha",
  "amit_shre$tha",
  "amit_shresth@",
  "amit_shre5tha",

  // Common user passwords
  "Amit123",
  "amit123",
  "Amit@123",
  "amit@123",
  "Amit@1234",
  "Shrestha123",
  "shrestha123",
  "AmitShrestha123",
  "amitshrestha123",
  "Amit786",
  "amit786",

  // With underscore variations
  "amit__shrestha",
  "_amit_shrestha",
  "amit_shrestha_",

  // Short versions
  "amit",
  "shrestha",
  "amit123",
  "shrestha123",
  "amit786",
  "shrestha786"
];

for (const pwd of passwords) {
  const match = await bcrypt.compare(pwd, hashFromDB);
  if (match) {
    console.log("Password found:", pwd);
    break;
  } else {
    console.log("Not match:", pwd);
  }
}