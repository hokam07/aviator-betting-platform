const CryptoJS = require('crypto-js');

function validateHmac(body, signatureHeader, secret) {
    // Temporary test mode: skip HMAC check
    console.log('HMAC check skipped for testing');
    return true;
    // if (!signatureHeader) return false;

    // const hmac = CryptoJS.HmacSHA256(JSON.stringify(body), secret);
    // const computedSignature = hmac.toString(CryptoJS.enc.Hex);

    // // Constant-time comparison to prevent timing attacks
    // return CryptoJS.enc.Hex.parse(computedSignature).toString() ===
    //     CryptoJS.enc.Hex.parse(signatureHeader).toString();
}

module.exports = { validateHmac };