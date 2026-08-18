import { connectToDatabase } from "../config/db";
import { Category } from "../models/Category";
import { Product } from "../models/Product";
import { DeliveryRate } from "../models/DeliveryRate";

async function seed() {
  await connectToDatabase();

  await Promise.all([Category.deleteMany({}), Product.deleteMany({}), DeliveryRate.deleteMany({})]);

  const [clothing, shoes, bags, electronics] = await Category.insertMany([
    { name: "Clothing", slug: "clothing", sortOrder: 1 },
    { name: "Shoes", slug: "shoes", sortOrder: 2 },
    { name: "Bags", slug: "bags", sortOrder: 3 },
    { name: "Electronics", slug: "electronics", sortOrder: 4 },
  ]);

  await Category.insertMany([
    { name: "Men's Shirts", slug: "mens-shirts", parent: clothing._id, sortOrder: 1 },
    { name: "Women's Dresses", slug: "womens-dresses", parent: clothing._id, sortOrder: 2 },
    { name: "Headphones", slug: "headphones", parent: electronics._id, sortOrder: 1 },
  ]);

  await Product.insertMany([
    {
      name: "Classic Cotton Shirt",
      slug: "classic-cotton-shirt",
      category: clothing._id,
      description: "Breathable cotton shirt, perfect for everyday wear.",
      images: [{ url: "https://placehold.co/800x800?text=Shirt", alt: "Classic Cotton Shirt" }],
      weightGrams: 250,
      attributeNames: ["color", "size"],
      variants: [
        { sku: "SHIRT-BLK-M", attributes: { color: "Black", size: "M" }, price: 1200, stock: 10, images: [] },
        { sku: "SHIRT-BLK-L", attributes: { color: "Black", size: "L" }, price: 1250, stock: 7, images: [] },
        { sku: "SHIRT-WHT-M", attributes: { color: "White", size: "M" }, price: 1200, stock: 5, images: [] },
      ],
      status: "active",
    },
    {
      name: "Running Sneakers",
      slug: "running-sneakers",
      category: shoes._id,
      description: "Lightweight sneakers built for daily runs.",
      images: [{ url: "https://placehold.co/800x800?text=Sneakers", alt: "Running Sneakers" }],
      weightGrams: 700,
      attributeNames: ["color", "euSize"],
      variants: [
        { sku: "SNKR-BLK-41", attributes: { color: "Black", euSize: "41" }, price: 3200, stock: 8, images: [] },
        { sku: "SNKR-BLK-42", attributes: { color: "Black", euSize: "42" }, price: 3200, stock: 6, images: [] },
      ],
      status: "active",
    },
    {
      name: "Everyday Tote Bag",
      slug: "everyday-tote-bag",
      category: bags._id,
      description: "Spacious tote for daily essentials.",
      images: [{ url: "https://placehold.co/800x800?text=Tote+Bag", alt: "Everyday Tote Bag" }],
      weightGrams: 400,
      attributeNames: ["color"],
      variants: [
        { sku: "TOTE-TAN", attributes: { color: "Tan" }, price: 1800, discountPrice: 1500, stock: 12, images: [] },
      ],
      status: "active",
    },
    {
      name: "Wireless Headphones",
      slug: "wireless-headphones",
      category: electronics._id,
      description: "Over-ear wireless headphones with 20-hour battery life.",
      images: [{ url: "https://placehold.co/800x800?text=Headphones", alt: "Wireless Headphones" }],
      weightGrams: 300,
      attributeNames: ["model", "color"],
      variants: [
        { sku: "HP-X1-BLK", attributes: { model: "X1", color: "Black" }, price: 4500, stock: 15, images: [] },
      ],
      status: "active",
    },
  ]);

  await DeliveryRate.insertMany([
    { zone: "inside_dhaka", baseCharge: 60, thresholdGrams: 1000, perKgCharge: 20 },
    { zone: "outside_dhaka", baseCharge: 120, thresholdGrams: 1000, perKgCharge: 30 },
  ]);

  console.log("Seed complete: 4 top-level categories, 3 subcategories, 4 products, 2 delivery rates.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
