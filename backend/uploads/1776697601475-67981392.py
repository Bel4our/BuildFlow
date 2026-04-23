from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
import time

def run_task_1():
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()))
    try:
        driver.maximize_window()
        driver.get("https://demoqa.com/elements")
        time.sleep(2)

        element_id = driver.find_element(By.ID, "item-2")
        print(f"1. Найдено по ID. Содержимое: '{element_id.text}'")

        css_1 = driver.find_element(By.CSS_SELECTOR, "div.element-list ul.menu-list > li#item-1")
        print(f"2.1. Найдено по CSS №1. Содержимое: '{css_1.text}'")

        css_2 = driver.find_element(By.CSS_SELECTOR, "div.element-group div.header-wrapper .header-text")
        print(f"2.2. Найдено по CSS №2. Содержимое: '{css_2.text}'")

        xpath_1 = driver.find_element(By.XPATH, "//li[contains(@class, 'btn-light') and descendant::span[text()='Web Tables']]")
        print(f"3.1. Найдено по XPath №1. Содержимое: '{xpath_1.text}'")

        xpath_2 = driver.find_element(By.XPATH, "//span[text()='Check Box']/ancestor::li/following-sibling::li[1]")
        print(f"3.2. Найдено по XPath №2. Содержимое: '{xpath_2.get_attribute('textContent')}'")

        driver.get("https://demoqa.com/links")
        time.sleep(2)
        
      
        partial_link = driver.find_element(By.PARTIAL_LINK_TEXT, "Crea")
        print(f"4. Найдено по части ссылки ('Crea'). Полный текст: '{partial_link.text}'")
        list_of_links = driver.find_elements(By.TAG_NAME, "a")
        print(f"5. Найдено {len(list_of_links)} ссылок. :")
        for link in list_of_links[-3:]:
            if link.text: print(f" - {link.text}")

    except Exception as e:
        print(f"Ошибка: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    run_task_1()