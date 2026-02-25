import pandas as pd
xls = pd.ExcelFile('Kev Ultimate Comeback.xlsx')
if '_DB_Blocks' in xls.sheet_names:
    df = pd.read_excel(xls, sheet_name='_DB_Blocks')
    print("DB_Blocks shape:", df.shape)
    print("Head:\n", df.head())
else:
    print("No _DB_Blocks in the local Excel file. Wait, the spreadsheet is in Google Sheets, not the local file.")
