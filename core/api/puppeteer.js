import puppeteer from "puppeteer-core";
import { mkdir, unlink } from "fs/promises";
import { join } from "path";
import os from "os";
import logger from "./logger.js";
import { execSync } from "child_process";

let executablePath;
// Termux自动获取chromium-browser
if (os.platform() === "android") {
  try {
    executablePath = execSync("which chromium-browser").toString().trim();
    if (!executablePath) {
      throw new Error("chromium-browser not found in PATH");
    }
  } catch (error) {
    logger.error(`Error getting chromium-browser path: ${error.message}`);
    throw error;
  }
  // Windows默认使用edge的路径
} else if (os.platform() === "win32") {
  executablePath =
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  //Linux
} else if (os.platform() === "linux") {
  executablePath = "chromium-browser";
}

logger.debug(`Using executable path: ${executablePath}`);

const outputDir = "./caching/puppeteer";

const ensureDirectoryExists = async (dir) => {
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    logger.error(`Error ensuring directory exists: ${err.message}`);
  }
};

// 重试
const retryFunction = async (fn, retries = 3, delay = 1000) => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      logger.error(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt >= retries) {
        throw new Error(`Failed after ${retries} attempts`);
      }
      // 延迟再试
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// 图片生成
const pimg = async (htmlContent, viewport = { width: 800, height: 600 }) => {
  let browser;
  const startTime = Date.now();

  const generateScreenshot = async () => {
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ["--no-sandbox", "--disable-gpu"],
      });

      const page = await browser.newPage();
      await page.setViewport(viewport);

      // 等待页面加载并设置内容
      await page.setContent(htmlContent, { waitUntil: "networkidle0" });

      // 确保目录存在
      await ensureDirectoryExists(outputDir);

      const fileName = `screenshot-${Date.now()}.png`;
      const outputPath = join(outputDir, fileName);

      // 截图并保存
      await page.screenshot({ path: outputPath });
      await page.close();

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      logger.debug(`Screenshot generated in ${duration} seconds`);

      return outputPath;
    } catch (error) {
      logger.error(`Error generating screenshot: ${error}`);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  };

  return await retryFunction(generateScreenshot);
};

// 删除图片
const deleteImage = async (filePath) => {
  try {
    await unlink(filePath);
  } catch (error) {
    logger.error(`Error deleting file: ${error.message}`);
    throw error;
  }
};

export { pimg, deleteImage };
