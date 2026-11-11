"""
Bakong KHQR Generator Service
Generates standard EMVCo-compliant KHQR payloads and CRC-16 checksums
for Cambodian Merchant payments in USD and KHR.
"""

def crc16_ccitt(data: str) -> str:
    """Calculates CRC-16 CCITT (0x1021) with 0xFFFF initial value as required by EMVCo."""
    crc = 0xFFFF
    for char in data.encode("utf-8"):
        crc ^= (char << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"

def build_emvco_tag(tag: str, value: str) -> str:
    """Encodes a tag with 2-digit length: Tag(2) + Length(2) + Value(N)"""
    return f"{tag}{len(value):02d}{value}"

def generate_khqr_payload(
    merchant_id: str,
    merchant_name: str,
    amount: float,
    currency: str = "USD",
    order_id: str = "ORDER1"
) -> str:
    """
    Generates a full Bakong Dynamic KHQR string.
    Currency: 840 (USD) or 116 (KHR)
    """
    currency_code = "840" if currency.upper() == "USD" else "116"
    amount_str = f"{amount:.2f}"

    # Merchant Account Information (Tag 29)
    sub_tag_bakong_id = build_emvco_tag("00", merchant_id)
    merchant_account_info = build_emvco_tag("29", sub_tag_bakong_id)

    # Additional Data (Tag 62) - Reference / Bill number
    sub_tag_ref = build_emvco_tag("01", order_id[:25])
    additional_data = build_emvco_tag("62", sub_tag_ref)

    payload_without_crc = (
        build_emvco_tag("00", "01") +                # Payload Format Indicator
        build_emvco_tag("01", "12") +                # Dynamic QR (Point of Initiation)
        merchant_account_info +                      # Tag 29: Merchant Info
        build_emvco_tag("52", "5732") +              # Tag 52: Merchant Category Code
        build_emvco_tag("53", currency_code) +       # Tag 53: Currency (840=USD)
        build_emvco_tag("54", amount_str) +          # Tag 54: Amount
        build_emvco_tag("58", "KH") +                # Tag 58: Country Code
        build_emvco_tag("59", merchant_name[:25]) +  # Tag 59: Merchant Name
        build_emvco_tag("60", "Phnom Penh") +        # Tag 60: City
        additional_data +                            # Tag 62: Additional Data (Order ID)
        "6304"                                       # Tag 63: CRC placeholder
    )

    crc_hex = crc16_ccitt(payload_without_crc)
    full_qr = payload_without_crc + crc_hex
    return full_qr

