import { HeroBanner } from "../models/HeroBanner";
import { Announcement } from "../models/Announcement";
import { WelcomePopup } from "../models/WelcomePopup";

// SAFE / ADDITIVE ONLY. Every check here is "insert a default if the
// collection/document doesn't exist yet" — never a delete, never an
// overwrite of something that already exists. This is what makes it safe to
// run against a live database with real Super Admin-edited content: existing
// HeroBanner rows and any already-created Announcement/WelcomePopup document
// are left completely untouched.
export async function ensureStorefrontDefaults(): Promise<void> {
  const heroBannerCount = await HeroBanner.countDocuments();
  if (heroBannerCount === 0) {
    // Original content from the Hero Slider's previously-hardcoded BANNERS
    // array — only inserted when the collection is genuinely empty, so this
    // never clobbers banners an admin has since edited, reordered, or added.
    await HeroBanner.insertMany([
      {
        titleBn: "নারী সংগ্রহ",
        titleEn: "Women's Collection",
        subtitleBn: "প্রতিদিনের জন্য মার্জিত ফিট।",
        subtitleEn: "Elegant, everyday-ready fits.",
        ctaLabelBn: "কেনাকাটা করুন",
        ctaLabelEn: "Shop Women",
        ctaUrl: "/categories/womens-dresses",
        desktopImage: "https://ik.imagekit.io/abdnimit/Model_wearing_women.jpeg",
        objectPosition: "80% center",
        isActive: true,
        sortOrder: 1,
      },
      {
        titleBn: "পুরুষ সংগ্রহ",
        titleEn: "Men's Collection",
        subtitleBn: "প্রতিদিনের জন্য উপযুক্ত স্মার্ট ফিট।",
        subtitleEn: "Sharp fits, built for every day.",
        ctaLabelBn: "কেনাকাটা করুন",
        ctaLabelEn: "Shop Men",
        ctaUrl: "/categories/mens-shirts",
        desktopImage: "https://ik.imagekit.io/abdnimit/Model_wearing_panjabi_for_banner_202608190117.jpeg",
        objectPosition: "center 20%",
        isActive: true,
        sortOrder: 2,
      },
      {
        titleBn: "জুতা ও ব্যাগ",
        titleEn: "Shoes & Bags",
        subtitleBn: "মাথা থেকে পা পর্যন্ত সাজ সম্পূর্ণ করুন।",
        subtitleEn: "Finish the outfit, head to toe.",
        ctaLabelBn: "এখনই কিনুন",
        ctaLabelEn: "Shop Now",
        ctaUrl: "/categories/shoes",
        desktopImage: "https://ik.imagekit.io/abdnimit/Model_wearing_shoe-bag.jpeg",
        objectPosition: "center center",
        isActive: true,
        sortOrder: 3,
      },
    ]);
    console.log("  + inserted 3 default hero banners (none existed)");
  } else {
    console.log(`  = ${heroBannerCount} hero banner(s) already exist, left untouched`);
  }

  const announcementExists = await Announcement.exists({});
  if (!announcementExists) {
    await Announcement.create({ enabled: false, messageEn: "", messageBn: "", marquee: false });
    console.log("  + inserted default announcement config (disabled)");
  } else {
    console.log("  = announcement config already exists, left untouched");
  }

  const welcomePopupExists = await WelcomePopup.exists({});
  if (!welcomePopupExists) {
    await WelcomePopup.create({ enabled: false });
    console.log("  + inserted default welcome popup config (disabled)");
  } else {
    console.log("  = welcome popup config already exists, left untouched");
  }
}
