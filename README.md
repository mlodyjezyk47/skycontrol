# SkyControl

Gotowy, responsywny panel demonstracyjny operacji lotniskowych, w języku polskim.

## Uruchomienie

1. Rozpakuj cały folder projektu.
2. Otwórz `index.html` w przeglądarce.
3. Pełną instrukcję uruchomienia i publikacji na GitHub Pages znajdziesz w `INSTRUKCJA.html` — ten plik także otworzysz dwuklikiem.

Nie trzeba instalować pakietów, uruchamiać serwera ani pisać kodu. Strona działa bez internetu.

## Funkcje

- Aktualna data i zegar (strefa Europe/Warsaw).
- 10 przykładowych odlotów, ręczna zmiana trzech statusów i szczegóły lotów.
- Wyszukiwanie bez konieczności wpisywania polskich znaków, filtry i sortowanie godzin.
- Liczniki i wykres realizacji planu aktualizowane po zmianie statusu.
- Ciemny i jasny motyw.
- Zapis statusów, motywu i 30 ostatnich zmian w localStorage.
- Eksport wszystkich lotów do CSV (UTF-8, separator średnik).
- Responsywny interfejs, menu mobilne, obsługa klawiaturą i ograniczanie animacji zgodnie z ustawieniami urządzenia.

## Pliki

- `index.html` — strona główna.
- `styles.css` — wygląd i responsywność.
- `app.js` — dane i działające funkcje.
- `favicon.svg` — ikona strony.
- `INSTRUKCJA.html` — prosta instrukcja dla użytkownika.
- `README.md` — ten opis.

## GitHub Pages w skrócie

Utwórz publiczne repozytorium `skycontrol`, prześlij pliki projektu bezpośrednio do jego głównego folderu, a następnie w **Settings → Pages** ustaw **Deploy from a branch → main → /(root) → Save**. Po publikacji otrzymasz adres podobny do `https://TWOJ-LOGIN.github.io/skycontrol/`.

## Dane i zapis

Wszystkie dane lotów są przykładowe. Statusy nie zmieniają się automatycznie. Przeglądarka zapisuje stan pod kluczami `skycontrol.operations.v1` i `skycontrol.theme.v1`. Uszkodzony zapis jest pomijany, a niedostępność localStorage nie blokuje aplikacji.

Zapis jest osobny dla urządzenia, przeglądarki i adresu strony. Nie jest synchronizowany między komputerem a telefonem. Tryb prywatny lub wyczyszczenie danych strony może usunąć ustawienia. Zachowanie localStorage pod `file://` zależy od przeglądarki; po publikacji na GitHub Pages strona korzysta ze zwykłego adresu HTTPS.

Nie ma zewnętrznych bibliotek, fontów pobieranych z sieci, analityki ani płatnych usług.

## Weryfikacja

Projekt przeszedł 60 kontroli w Chromium: interakcje, zapis po odświeżeniu, eksport CSV, obsługa uszkodzonej i zablokowanej pamięci, okna dialogowe, klawiatura i szerokości ekranu od 320 do 1920 pikseli. Nie wykryto błędów JavaScript.

Testy przeglądarkowe wykonano przez lokalny podgląd HTTP, ponieważ przeglądarka środowiska testowego blokuje adresy `file://`. Bezpośredniego otwierania z dysku nie zweryfikowano w tym środowisku. Projekt używa zwykłych względnych odnośników do plików CSS i JS, bez modułów ani zapytań do serwera, i jest przygotowany do otwierania przez `index.html`.
