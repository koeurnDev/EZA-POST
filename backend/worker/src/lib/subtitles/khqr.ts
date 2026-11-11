export function crc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag: string, value: string): string {
  const lengthStr = String(value.length).padStart(2, '0');
  return `${tag}${lengthStr}${value}`;
}

export function generateBakongKhqr(
  accountId: string = 'seab_koeurn@bkrt',
  merchantName: string = 'EZA POST',
  amountUsd: number = 29.00,
  orderId: string = 'ORD-001'
): { qrText: string; md5Hash: string } {
  // EMVCo Merchant Account Information (Tag 29)
  const tag29Value =
    tlv('00', 'bakong@bkrt') +
    tlv('01', accountId);

  // Construct EMVCo Payload
  const rawPayload =
    tlv('00', '01') +                                // Payload Format Indicator
    tlv('01', '12') +                                // Point of Initiation (12 = Dynamic)
    tlv('29', tag29Value) +                          // Merchant Account Information
    tlv('52', '5999') +                              // Merchant Category Code
    tlv('53', '840') +                               // Transaction Currency (840 = USD)
    tlv('54', amountUsd.toFixed(2)) +                // Amount
    tlv('58', 'KH') +                                // Country Code
    tlv('59', merchantName) +                        // Merchant Name
    tlv('60', 'Phnom Penh') +                        // Merchant City
    tlv('62', tlv('01', orderId)) +                  // Additional Data (Bill/Order Reference)
    '6304';                                          // CRC-16 Tag Placeholder

  const crc = crc16Ccitt(rawPayload);
  const qrText = rawPayload + crc;

  return {
    qrText,
    md5Hash: `md5_${orderId}`
  };
}

