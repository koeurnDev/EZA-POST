from pdf2docx import Converter
import sys
import os

# Suppress warnings
import warnings
warnings.filterwarnings("ignore")

def convert_pdf_to_docx(pdf_file, docx_file):
    try:
        # print(" Converting PDF to DOCX...")
        cv = Converter(pdf_file)
        cv.convert(docx_file, start=0, end=None)
        cv.close()
        # print(f"Success: {docx_file}")
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pdf_to_docx_py.py <input_pdf> <output_docx>")
        sys.exit(1)
        
    input_pdf = sys.argv[1]
    output_docx = sys.argv[2]
    
    convert_pdf_to_docx(input_pdf, output_docx)
