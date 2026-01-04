const { BakongKHQR, khqrData, IndividualInfo } = require("bakong-khqr");

const idsToTest = [
    "855968200064",
    "0968200064",
    "855968200064@wing",
    "85512345678@aba",
    "koeurn_seab@wing"
];

console.log("🔍 Testing BAKONG-KHQR Object Syntax...");

idsToTest.forEach(id => {
    try {
        // Match server.js logic for cleaning ID
        let cleanId = id;
        // Simulate the server logic:
        cleanId = cleanId.replace(/\s/g, '').replace(/-/g, '');
        if (cleanId.startsWith('0')) cleanId = '855' + cleanId.substring(1);
        if (!cleanId.includes('@')) cleanId += '@wing';


        const info = new IndividualInfo(
            cleanId,
            "Test Shop",
            "Phnom Penh",
            1.00,
            khqrData.currency.usd,
            "Test Shop",
            "001",
            "123"
        );

        const khqr = new BakongKHQR();
        const result = khqr.generateIndividual(info);

        if (result && result.status.code === 0) {
            console.log(`✅ VALID: '${id}' -> '${cleanId}'`);
        } else {
            console.log(`❌ INVALID: '${id}' -> '${cleanId}' -> ${result?.status?.message}`);
        }
    } catch (e) {
        console.log(`❌ CRASH: '${id}' -> ${e.message}`);
    }
});
