import pandas as pd
import numpy as np

books = pd.read_csv("C:\\Users\\bhara\\Downloads\\books (1).csv")
categories = pd.read_csv("C:\\Users\\bhara\\Downloads\\categories.csv")

merged = books.merge(
    categories,
    left_on="category_id",
    right_on="id",
    how="left"
)

import_books = pd.DataFrame({
    "accession_no": merged["access_no"],
    "title": merged["book_name"],
    "author": merged["author_name"],
    "category": merged["name"],
    "category_id": merged["category_id"],
    "shelf_location": merged["cupboard_no"].astype(str),
    "rack_no": merged["s_no"].astype(str),
    "source_s_no": merged["s_no"],
    "total_copies": 1,
    "available_copies": merged["availability"].astype(int),
    "status": np.where(
        merged["availability"].astype(int).eq(1),
        "available",
        "issued"
    )
})

import_books_path = "C:\\Users\\bhara\\Downloads\\books (1).csv"
categories_path = "C:\\Users\\bhara\\Downloads\\categories.csv"

import_books.to_csv(import_books_path, index=False)
categories.to_csv(categories_path, index=False)

print(f"Prepared {len(import_books):,} book records.")
print(f"Prepared {len(categories):,} categories.")
print(f"Available: {(merged['availability'] == 1).sum():,}")
print(f"Not available: {(merged['availability'] == 0).sum():,}")
print(f"Duplicate accession numbers in source: {merged['access_no'].duplicated(keep=False).sum():,} rows")
print(f"Missing author values preserved as blank: {merged['author_name'].isna().sum():,}")

print("\nFiles ready:")
print(import_books_path)
print(categories_path)
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
63a0fb41-e40a-4745-9009-e94e8b199545