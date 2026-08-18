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

  const [mensShirts, , , abayaBorka] = await Category.insertMany([
    { name: "Men's Shirts", slug: "mens-shirts", parent: clothing._id, sortOrder: 1 },
    { name: "Women's Dresses", slug: "womens-dresses", parent: clothing._id, sortOrder: 2 },
    { name: "Headphones", slug: "headphones", parent: electronics._id, sortOrder: 1 },
    { name: "Abaya & Borka", slug: "abaya-borka", parent: clothing._id, sortOrder: 3 },
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
    {
      name: "Elegant Abaya",
      slug: "elegant-abaya",
      category: abayaBorka._id,
      description: "Flowing, modest abaya in a soft, breathable fabric.",
      images: [{ url: "https://ik.imagekit.io/abdnimit/Product%20Dummy%20images%20/abaya.jpeg", alt: "Elegant Abaya" }],
      weightGrams: 450,
      attributeNames: ["color", "size"],
      variants: [
        { sku: "ABAYA-BLK-M", attributes: { color: "Black", size: "M" }, price: 2200, stock: 10, images: [] },
        { sku: "ABAYA-BLK-L", attributes: { color: "Black", size: "L" }, price: 2200, stock: 8, images: [] },
        { sku: "ABAYA-BLK-XL", attributes: { color: "Black", size: "XL" }, price: 2300, stock: 5, images: [] },
      ],
      status: "active",
    },
    {
      name: "Classic Borka",
      slug: "classic-borka",
      category: abayaBorka._id,
      description: "Everyday borka with a comfortable, easy-movement cut.",
      images: [{ url: "https://ik.imagekit.io/abdnimit/Product%20Dummy%20images%20/Borka.jpeg", alt: "Classic Borka" }],
      weightGrams: 500,
      attributeNames: ["color", "size"],
      variants: [
        { sku: "BORKA-BLK-M", attributes: { color: "Black", size: "M" }, price: 1900, stock: 12, images: [] },
        { sku: "BORKA-BLK-L", attributes: { color: "Black", size: "L" }, price: 1900, stock: 9, images: [] },
      ],
      status: "active",
    },
    {
      name: "Men's Formal Shirt",
      slug: "mens-formal-shirt",
      category: mensShirts._id,
      description: "Tailored formal shirt for work and occasions.",
      images: [{ url: "https://ik.imagekit.io/abdnimit/Product%20Dummy%20images%20/shirt-men.jpeg", alt: "Men's Formal Shirt" }],
      weightGrams: 280,
      attributeNames: ["color", "size"],
      variants: [
        { sku: "MSHIRT-WHT-M", attributes: { color: "White", size: "M" }, price: 1400, stock: 10, images: [] },
        { sku: "MSHIRT-WHT-L", attributes: { color: "White", size: "L" }, price: 1400, stock: 8, images: [] },
        { sku: "MSHIRT-BLU-M", attributes: { color: "Blue", size: "M" }, price: 1450, stock: 6, images: [] },
      ],
      status: "active",
    },
    {
      name: "Everyday Shoulder Bag",
      slug: "everyday-shoulder-bag",
      category: bags._id,
      description: "Compact shoulder bag for daily essentials.",
      images: [{ url: "https://ik.imagekit.io/abdnimit/Product%20Dummy%20images%20/bag.jpeg", alt: "Everyday Shoulder Bag" }],
      weightGrams: 350,
      attributeNames: ["color"],
      variants: [
        { sku: "SBAG-BLK", attributes: { color: "Black" }, price: 1600, stock: 14, images: [] },
        { sku: "SBAG-TAN", attributes: { color: "Tan" }, price: 1600, discountPrice: 1350, stock: 7, images: [] },
      ],
      status: "active",
    },
    {
      name: "Men's Casual Shoes",
      slug: "mens-casual-shoes",
      category: shoes._id,
      description: "Everyday casual shoes with a comfortable fit.",
      images: [{ url: "https://ik.imagekit.io/abdnimit/Product%20Dummy%20images%20/shoes-men.jpeg", alt: "Men's Casual Shoes" }],
      weightGrams: 750,
      attributeNames: ["color", "euSize"],
      variants: [
        { sku: "MSHOE-BRN-42", attributes: { color: "Brown", euSize: "42" }, price: 2800, stock: 9, images: [] },
        { sku: "MSHOE-BRN-43", attributes: { color: "Brown", euSize: "43" }, price: 2800, stock: 6, images: [] },
      ],
      status: "active",
    },
  ]);

  await DeliveryRate.insertMany([
    { zone: "inside_dhaka", baseCharge: 60, thresholdGrams: 1000, perKgCharge: 20 },
    { zone: "outside_dhaka", baseCharge: 120, thresholdGrams: 1000, perKgCharge: 30 },
  ]);

  console.log("Seed complete: 4 top-level categories, 4 subcategories, 9 products, 2 delivery rates.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
