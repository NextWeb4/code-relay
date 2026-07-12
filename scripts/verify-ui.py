from playwright.sync_api import sync_playwright, expect


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 900})
        page.goto("http://127.0.0.1:4173/")
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_selector("#languageToggle")

        expect(page).to_have_title("Code Relay · 邮箱验证码聚合台")
        expect(page.get_by_text("HaoXiang Huang")).to_be_visible()
        expect(page.locator("#languageToggle")).to_have_text("EN")
        expect(page.locator("#openImportButton")).to_be_visible()

        page.locator("#languageToggle").click()
        expect(page).to_have_title("Code Relay · Mail Verification Code Console")
        expect(page.locator("#languageToggle")).to_have_text("中文")
        expect(page.get_by_text("Owned GitHub Accounts")).to_be_visible()
        expect(page.get_by_text("Author metadata is fixed for release")).to_be_visible()
        assert page.evaluate("localStorage.getItem('codeRelayLanguage')") == "en"

        browser.close()


if __name__ == "__main__":
    main()
