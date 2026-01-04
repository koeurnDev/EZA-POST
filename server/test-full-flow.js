const fs = require('fs');
const path = require('path');

async function testFullFlow() {
    try {
        console.log("Step 1: Uploading file...");
        const formData = new FormData();
        const fileBlob = new Blob(['This is a test image content'], { type: 'text/plain' });
        formData.append('image', fileBlob, 'test-image.txt');

        const uploadRes = await fetch('http://localhost:5000/api/upload', {
            method: 'POST',
            body: formData
        });

        console.log("Upload Status:", uploadRes.status);
        const text = await uploadRes.text();
        console.log("Upload Raw Response:", text.substring(0, 500)); // Print first 500 chars

        if (!uploadRes.ok) throw new Error("Upload HTTP Error");

        const uploadData = JSON.parse(text);
        if (!uploadData.success) throw new Error("Upload API Success=False");

        // 3. Update User with URL
        console.log("Step 2: Updating user u1 with new URL...");
        const newAvatarUrl = uploadData.url;

        const updateRes = await fetch('http://localhost:5000/api/users/u1', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "Ashwin TestFlow",
                email: "ashwin@test.com",
                avatar: newAvatarUrl
            })
        });
        const updateData = await updateRes.json();
        console.log("Update Response:", updateData);

        if (!updateData.success) throw new Error("Update Failed");
        console.log("Flow Verified Successfully!");

    } catch (e) {
        console.error("Test Failed:", e);
    }
}

testFullFlow();
