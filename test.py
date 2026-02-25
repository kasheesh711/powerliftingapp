import pandas as pd
import warnings
warnings.filterwarnings("ignore")

xls = pd.ExcelFile('Kev Ultimate Comeback.xlsx')
df = pd.read_excel(xls, sheet_name='Block 5', header=None)

for r in range(df.shape[0]):
    if pd.notna(df.iloc[r, 1]) and type(df.iloc[r, 1]) == str and "DAY" in str(df.iloc[r, 1]).upper():
        print(f"Row {r}: {df.iloc[r, 1]}")
