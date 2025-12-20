# **Raport Techniczny: Specyfikacja Architektury "Web Automation Bridge" dla Integracji Gemini w Chrome Manifest V3**

## **Wprowadzenie i Potwierdzenie Zrozumienia**

Niniejszy dokument stanowi wyczerpującą analizę techniczną i specyfikację wdrożeniową dla projektu autorskiego rozszerzenia przeglądarkowego typu "Side Panel Bridge". Raport został przygotowany w odpowiedzi na wymaganie stworzenia narzędzia w filozofii "hacker style" – rozwiązania prywatnego, pozbawionego korporacyjnego bloatware'u, omijającego płatne API i zapewniającego funkcjonalność kontekstową (Context-Aware AI) na poziomie przeglądarek Arc Max czy Microsoft Edge Copilot.

Potwierdzenie Modelu Architektonicznego ("The Bridge"):  
Zrozumiano i zatwierdzono architekturę "Web Automation Bridge". System nie będzie komunikował się z Google Gemini poprzez REST API (co generowałoby koszty i wymagało zarządzania kluczami), lecz będzie działał jako warstwa pośrednicząca (middleware) między aktywną kartą przeglądarki a instancją interfejsu webowego gemini.google.com uruchomioną w izolowanym panelu bocznym. Rozszerzenie przejmuje rolę "cyfrowego operatora", który automatyzuje proces kopiowania zaznaczonego tekstu, wklejania go do pola czatu i inicjowania interakcji, symulując zachowanie ludzkiego użytkownika. Jest to podejście "Zero-Cost, Local-First".  
Dokument ten, o objętości przekraczającej standardowe specyfikacje, ma na celu nie tylko zdefiniowanie kroków implementacyjnych, ale także dogłębne zrozumienie mechanizmów przeglądarki Chromium, które umożliwiają (i utrudniają) takie działanie w rygorystycznym środowisku Manifest V3.

## ---

**Rozdział 1: Analiza Strategiczna i Filozofia Rozwiązania "Anti-Corpo"**

### **1.1 Ewolucja Ekosystemu Rozszerzeń: Dlaczego "Bridge"?**

Współczesny ekosystem rozszerzeń przeglądarkowych znajduje się w punkcie zwrotnym wymuszonym przez migrację z Manifest V2 (MV2) do Manifest V3 (MV3). Zmiana ta, promowana przez Google pod hasłami bezpieczeństwa i wydajności, w rzeczywistości drastycznie ogranicza możliwości blokowania treści i modyfikacji żądań sieciowych, co uderza w narzędzia typu adblockery czy zaawansowane skrypty użytkownika.

W kontekście naszego projektu, wybór architektury "Web Automation Bridge" jest bezpośrednią odpowiedzią na te ograniczenia oraz na komercjalizację dostępu do AI.

| Cecha | Podejście API (Standardowe) | Podejście "Store Plugin" (Komercyjne) | Podejście "Web Automation Bridge" (Nasze) |
| :---- | :---- | :---- | :---- |
| **Model Kosztowy** | Pay-per-token (OpEx). Każde zapytanie kosztuje. | Freemium. Dane użytkownika są walutą. | **Zero Kosztów**. Wykorzystuje darmową warstwę webową. |
| **Prywatność** | Dane przesyłane do endpointów API. Logowanie po stronie serwera. | Wysokie ryzyko. Często pośrednicy (proxy) zbierają prompty. | **Local-First**. Komunikacja bezpośrednia Client \<-\> Google. |
| **Ciągłość Sesji** | Bezstanowa (Stateless). Historia w lokalnej bazie rozszerzenia. | Zależna od dostawcy. Często brak synchronizacji z kontem Google. | **Pełna Synchronizacja**. Historia dostępna na gemini.google.com. |
| **Złożoność** | Niska (REST/JSON). | Niska (Gotowe rozwiązanie). | **Wysoka**. Wymaga inżynierii wstecznej DOM i obejść security. |
| **Trwałość** | Wysoka (Wersjonowane API). | Zależna od dostawcy. | **Niska/Średnia**. Podatność na zmiany UI/DOM Google. |

Tabela ta jasno wskazuje, że dla zaawansowanego użytkownika (Power User), który akceptuje konieczność okresowej konserwacji kodu (aktualizacja selektorów), model "Bridge" oferuje bezkonkurencyjny stosunek użyteczności do prywatności i kosztów.1

### **1.2 "Hacker Style" jako Wymóg Operacyjny**

Termin "hacker style" w kontekście tego projektu nie jest jedynie stylistyką, ale zbiorem konkretnych wymagań niefunkcjonalnych:

1. **Minimalizm (No Bloatware):** Kod nie zawiera żadnych bibliotek analitycznych (Google Analytics, Mixpanel), żadnych systemów logowania "telemetrycznego" i żadnych zbędnych frameworków UI. Interfejs to czysty HTML/CSS lub surowy widok gemini.google.com.  
2. **Przejrzystość (Open Source):** Cała logika jest widoczna w plikach .js. Nie używamy zaciemnionego (obfuscated) kodu ani binarnych blobów.  
3. **Agnostycyzm Platformowy (w granicach Chromium):** Rozszerzenie powinno działać nie tylko w Chrome, ale też w Brave, Edge czy Vivaldi, ignorując specyficzne dla Google "udogodnienia", które mogą naruszać prywatność.

Wdrażając ten system, tworzymy de facto prywatną nakładkę na publiczną usługę, odzyskując kontrolę nad interfejsem użytkownika. Jest to realizacja idei "User Agent" w jej pierwotnym znaczeniu – oprogramowanie działające w imieniu i na rzecz użytkownika, a nie usługodawcy.

## ---

**Rozdział 2: Środowisko Wykonawcze Chrome Manifest V3**

Zrozumienie ograniczeń Manifest V3 jest kluczowe dla sukcesu projektu, ponieważ architektura "Bridge" balansuje na granicy tego, na co Google pozwala w ramach nowych polityk bezpieczeństwa.

### **2.1 API sidePanel – Nowy Standard Interfejsu**

Wprowadzenie API sidePanel w Chrome 114+ 3 zmieniło paradygmat tworzenia "towarzyszy przeglądania". Wcześniej rozszerzenia musiały wstrzykiwać \<iframe\> bezpośrednio do drzewa DOM każdej odwiedzanej strony (Content Script Injection). Było to problematyczne z kilku powodów:

* **Konflikty CSS:** Style strony mogły nadpisywać style panelu (tzw. style bleeding).  
* **Izolacja Zdarzeń:** Skrypty strony mogły wykrywać i blokować panel.  
* **Resetowanie Stanu:** Przeładowanie karty zamykało panel.

API sidePanel rozwiązuje te problemy, oferując natywny kontener UI, który jest odseparowany od strony, ale dzieli z nią okno przeglądarki. Panel ten jest trwały (persistent) pomiędzy przełączeniami kart, co jest kluczowe dla ciągłości konwersacji z AI.4

**Kluczowe Ograniczenie:** Manifest V3 wymaga, aby zasób ładowany w panelu bocznym był plikiem lokalnym rozszerzenia (np. sidepanel.html). Nie można zadeklarować zewnętrznego adresu URL (np. https://gemini.google.com) bezpośrednio w pliku manifest.json jako default\_path.4

**Implikacja Architektoniczna:** Musimy zastosować technikę "Local Wrapper". Tworzymy plik sidepanel.html, który zawiera w sobie pełnoekranowy element \<iframe\>, którego źródłem (src) jest dopiero https://gemini.google.com/app. To z kolei prowadzi nas do problemu X-Frame-Options, omówionego w Rozdziale 3\.

### **2.2 Śmierć "Background Page" i Narodziny "Service Workerów"**

W Manifest V2 istniała "strona w tle" (background page), która mogła utrzymywać stan (zmienne, połączenia WebSocket) przez cały czas działania przeglądarki. W MV3 została ona zastąpiona przez **Service Worker**.

Service Worker jest efemeryczny (ulotny). Budzi się w odpowiedzi na zdarzenie (np. kliknięcie w menu kontekstowe), wykonuje zadanie i jest usypiany przez przeglądarkę po kilkudziesięciu sekundach bezczynności.6

Wyzwanie dla Projektu: Nie możemy przechowywać "kolejki promptów" w zmiennej globalnej w background.js, ponieważ zmienna ta zniknie, gdy worker zostanie uśpiony.  
Rozwiązanie: Konieczne jest użycie chrome.storage.local jako trwałego bufora komunikacyjnego. Kiedy użytkownik zaznacza tekst i klika "Wyślij do Gemini", Service Worker zapisuje ten tekst w chrome.storage. Panel boczny (lub skrypt w nim działający) musi nasłuchiwać zmian w tym magazynie (chrome.storage.onChanged).5

## ---

**Rozdział 3: Protokół "Frame Busting" i Zarządzanie Siecią**

Największym wyzwaniem technicznym w architekturze "Bridge" jest oszukanie mechanizmów bezpieczeństwa samej przeglądarki i serwerów Google, aby pozwoliły na załadowanie gemini.google.com wewnątrz ramki (iframe) naszego rozszerzenia.

### **3.1 Anatomia Blokady: X-Frame-Options i CSP**

Standardowe aplikacje webowe Google wysyłają w nagłówkach odpowiedzi HTTP następujące dyrektywy bezpieczeństwa:

1. X-Frame-Options: SAMEORIGIN lub DENY – instruuje przeglądarkę, aby nie renderowała strony, jeśli jest ona osadzona w ramce na innej domenie. Ponieważ nasze rozszerzenie działa w protokole chrome-extension://\[id\], a Gemini w https://gemini.google.com, warunek "Same Origin" nie jest spełniony.  
2. Content-Security-Policy: frame-ancestors 'self' – nowocześniejszy odpowiednik powyższego, dający bardziej granularną kontrolę, ale z tym samym skutkiem: blokada renderowania.7

Bez obejścia tych zabezpieczeń, w panelu bocznym zobaczymy jedynie szary ekran z ikoną "smutnej buźki" i komunikatem "refused to connect".

### **3.2 Rozwiązanie: declarativeNetRequest API**

W Manifest V2 używalibyśmy API webRequest w trybie blokującym (blocking), aby przechwycić nagłówki *zanim* trafią do silnika renderującego i po prostu je usunąć. W Manifest V3, API webRequestBlocking jest dostępne tylko dla rozszerzeń korporacyjnych (force-installed). Dla zwykłych użytkowników Google przygotowało declarativeNetRequest (DNR).2

DNR działa na innej zasadzie: zamiast wykonywać kod JavaScript dla każdego zapytania (co spowalnia przeglądarkę), rozszerzenie dostarcza na starcie listę reguł (plik JSON), które silnik przeglądarki aplikuje samodzielnie. Jest to bardziej wydajne i prywatne (rozszerzenie nie widzi treści URLi), ale mniej elastyczne.

Konfiguracja Reguł DNR (Ruleset):  
Aby skutecznie zdjąć blokadę, musimy zdefiniować regułę, która usunie specyficzne nagłówki dla zasobów ładowanych jako sub\_frame z domeny Gemini.

JSON

{  
  "id": 1,  
  "priority": 1,  
  "action": {  
    "type": "modifyHeaders",  
    "responseHeaders":  
  },  
  "condition": {  
    "urlFilter": "||gemini.google.com",  
    "resourceTypes": \["sub\_frame"\]  
  }  
}

**Analiza Ryzyka:** Usunięcie nagłówka Content-Security-Policy (CSP) jest działaniem agresywnym. Teoretycznie otwiera to ramkę na ataki typu Clickjacking. Jednakże, ponieważ nadrzędną ramką jest nasze własne, lokalne rozszerzenie (któremu ufamy), ryzyko jest minimalne. Ważne jest, aby reguła była ściśle ograniczona (urlFilter) tylko do domeny Gemini, aby nie osłabiać bezpieczeństwa podczas przeglądania innych stron.9

### **3.3 Problem Cross-Origin Resource Policy (CORP)**

W niektórych przypadkach Google może stosować dodatkowe nagłówki, takie jak Cross-Origin-Opener-Policy (COOP) lub Cross-Origin-Resource-Policy (CORP). Chociaż obecnie główną przeszkodą jest X-Frame-Options, architektura musi być gotowa na rozszerzenie reguł DNR o usuwanie również tych nagłówków, jeśli Gemini zaktualizuje swoje polityki bezpieczeństwa w 2025 roku.12

## ---

**Rozdział 4: Inżynieria Wsteczna Interfejsu Gemini**

Aby skutecznie sterować interfejsem Gemini, musimy zrozumieć, jak jest on zbudowany. Gemini to nowoczesna aplikacja typu Single Page Application (SPA), prawdopodobnie zbudowana w oparciu o wewnętrzne frameworki Google (Wiz, Lit lub odmianę Angulara), które stosują agresywną optymalizację i zaciemnianie kodu (obfuscation).

### **4.1 Analiza DOM i Dynamiczne Klasy**

Inspekcja kodu źródłowego gemini.google.com ujawnia, że nazwy klas CSS są generowane automatycznie podczas kompilacji i nie mają znaczenia semantycznego (np. .Ud74SD, .Iy732). Opieranie się na nich (np. document.querySelector('.Ud74SD')) jest błędem, ponieważ przy kolejnym wdrożeniu (deploy) aplikacji przez Google, nazwy te ulegną zmianie, co "zepsuje" nasze rozszerzenie.13

Strategia Stabilnych Selektorów:  
Zamiast klas, musimy szukać "kotwic" (anchors), które są niezbędne dla działania samej aplikacji lub jej dostępności (Accessibility \- a11y). Google, jako lider w dziedzinie a11y, dba o to, by ich aplikacje były czytelne dla czytników ekranowych. To nasza furtka.

1. **Atrybuty ARIA i Role:**  
   * Pole tekstowe często posiada atrybut role="textbox" lub aria-label="Enter a prompt".  
   * Przycisk wysyłania zazwyczaj ma aria-label="Send message" lub aria-label="Submit". Te wartości zmieniają się rzadziej niż klasy, ponieważ są powiązane z tłumaczeniami interfejsu, a nie jego stylem wizualnym.  
2. **Atrybut contenteditable:**  
   * Nowoczesne edytory tekstu w webie (Rich Text Editors) prawie zawsze są oparte na elemencie \<div\> z atrybutem contenteditable="true". Jest to bardzo silny, unikalny selektor w kontekście formularza czatu.15  
3. **Struktura DOM:**  
   * Jako ostateczność (fallback), możemy polegać na relacjach rodzic-dziecko, o ile są one proste, np. rich-textarea \> p.

### **4.2 Rehydratacja i Wirtualny DOM**

Proste wstawienie tekstu do pola poprzez element.innerText \= "Tekst" nie zadziała w aplikacji typu React/Lit. Framework utrzymuje swój własny, wirtualny stan aplikacji. Jeśli zmienimy DOM "pod spodem", framework tego nie zauważy i przy próbie wysłania wiadomości wyśle pusty ciąg znaków (ponieważ w jego wewnętrznym stanie zmienna userInput nadal jest pusta).

Konieczność Symulacji Zdarzeń:  
Aby "obudzić" framework i zmusić go do zaktualizowania stanu, musimy symulować zdarzenia, które normalnie generuje przeglądarka podczas pisania:

1. focus – aktywacja pola.  
2. input – wprowadzanie danych.  
3. keydown / keyup – naciśnięcia klawiszy.

Najbardziej niezawodną metodą, mimo że oficjalnie przestarzałą (deprecated), pozostaje document.execCommand('insertText', false, text). Metoda ta jest obsługiwana przez silnik przeglądarki na bardzo niskim poziomie i poprawnie wyzwala wszystkie powiązane zdarzenia (input, change), które frameworki UI nasłuchują.14 Alternatywą jest tworzenie syntetycznych zdarzeń InputEvent z opcją bubbles: true.

## ---

**Rozdział 5: Mechanika "Mostu" (Injection & Messaging)**

W tym rozdziale zdefiniujemy, jak fizycznie połączyć odseparowane światy: stronę źródłową (gdzie jest użytkownik) i stronę docelową (gdzie jest Gemini).

### **5.1 Izolacja Kontekstów (The Sandbox Problem)**

Mamy do czynienia z trzema odrębnymi kontekstami wykonawczymi:

1. **Main World (Strona WWW):** Tutaj nie mamy dostępu.  
2. **Extension Context (Background/SidePanel):** Tutaj mamy dostęp do API Chrome, ale nie do DOM Gemini.  
3. **Isolated World (Content Script w Iframe):** To jest nasz "Agent" (gemini\_driver.js). Działa on *wewnątrz* ramki z Gemini, ma dostęp do jej DOM, ale nie ma dostępu do zmiennych JavaScript samej strony Gemini (zmienne window są odseparowane). Ma jednak dostęp do DOM i może komunikować się z Extension Context.

**Kluczowe Zrozumienie:** Nie możemy po prostu załadować skryptu w sidepanel.html i oczekiwać, że będzie on sterował zawartością iframe'a. Ze względu na Cross-Origin Policy, skrypt z sidepanel.html (pochodzący z chrome-extension://) nie może czytać contentWindow iframe'a (pochodzącego z https://google.com).

**Rozwiązanie:** Musimy użyć mechanizmu **Content Scripts** zdefiniowanego w manifeście, ustawiając flagę "all\_frames": true. Dzięki temu Chrome automatycznie "wstrzyknie" nasz skrypt sterujący (gemini\_driver.js) bezpośrednio do wnętrza ramki z Gemini, gdy tylko zostanie ona załadowana w panelu bocznym. To jest techniczne serce architektury "Bridge".17

### **5.2 Protokół Komunikacyjny (Asynchroniczny)**

Przepływ danych musi być odporny na asynchroniczność ładowania się Gemini. Użytkownik może kliknąć "Wyślij", zanim panel boczny zdąży się w pełni załadować.

**Sekwencja Zdarzeń:**

1. **Zdarzenie A (Użytkownik):** Zaznaczenie tekstu \+ Menu kontekstowe.  
2. **Service Worker (background.js):**  
   * Odbiera info.selectionText.  
   * Zapisuje obiekt { "status": "pending", "text": "..." } do chrome.storage.local.  
   * Wywołuje chrome.sidePanel.open().  
3. **Panel Boczny (sidepanel.html):**  
   * Ładuje się.  
   * Ładuje \<iframe src="gemini..."\>.  
4. **Content Script (gemini\_driver.js):**  
   * Zostaje wstrzyknięty do iframe'a.  
   * Uruchamia obserwatora (MutationObserver lub setInterval), czekając aż pole tekstowe Gemini pojawi się w DOM.  
   * Sprawdza chrome.storage.local.  
   * Jeśli znajdzie status "pending":  
     * Pobiera tekst.  
     * Wykonuje sekwencję wstrzykiwania (Focus \-\> Insert \-\> Send).  
     * Czyści storage (ustawia status na "done").  
   * Rejestruje nasłuchiwacz chrome.storage.onChanged na wypadek kolejnych promptów wysyłanych bez przeładowania panelu.

Taki model (Storage-based Message Queue) gwarantuje, że żaden prompt nie zginie, nawet jeśli Gemini ładuje się 10 sekund.5

## ---

**Rozdział 6: Specyfikacja Implementacyjna (The Code Blueprint)**

W tej sekcji przedstawiamy szczegółowe wytyczne dla poszczególnych komponentów systemu, gotowe do przekształcenia w kod przez agenta programistycznego.

### **6.1 Manifest (manifest.json)**

To plik konfiguracyjny definiujący uprawnienia. Musi być precyzyjny, aby uniknąć odrzucenia przez Chrome (choć w trybie developerskim "Unpacked" jest to mniej istotne, to dobra praktyka).

* "manifest\_version": 3  
* "permissions":  
  * "sidePanel": Do otwierania panelu.  
  * "contextMenus": Do obsługi prawokliku.  
  * "storage": Do przekazywania danych.  
  * "declarativeNetRequest": Do usuwania nagłówków.  
* "host\_permissions":  
  * "https://gemini.google.com/\*": Niezbędne, aby wstrzyknąć skrypt do iframe'a i zdjąć blokady DNR.  
* "background":  
  * "service\_worker": "background.js"  
* "side\_panel":  
  * "default\_path": "sidepanel.html"  
* "content\_scripts":  
  * matches: \["https://gemini.google.com/\*"\]  
  * js: \["gemini\_driver.js"\]  
  * all\_frames: true (KRYTYCZNE: bez tego skrypt nie wejdzie do iframe'a w panelu).  
  * run\_at: document\_idle

### **6.2 Reguły Sieciowe (rules.json)**

Zdefiniowane w declarativeNetRequest.

* **Cel:** Usunięcie X-Frame-Options i Content-Security-Policy.  
* **Scope:** Tylko urlFilter: "||gemini.google.com" i resourceTypes: \["sub\_frame"\].  
* **Akcja:** remove dla wybranych nagłówków.

### **6.3 Logika Sterownika (gemini\_driver.js)**

To najbardziej skomplikowany element. Musi zawierać logikę "retry" (ponawiania prób).

**Algorytm Selektora (Selector Strategy Pattern):**

JavaScript

function findInput() {  
  // Próba 1: Standardowy contenteditable (najbardziej stabilny)  
  const editor \= document.querySelector('div\[contenteditable="true"\]');  
  if (editor) return editor;

  // Próba 2: Rola (dostępność)  
  const roleBox \= document.querySelector('div\[role="textbox"\]');  
  if (roleBox) return roleBox;

  // Próba 3: Historyczna struktura (dla wstecznej kompatybilności)  
  const legacy \= document.querySelector('rich-textarea p');  
  return legacy;  
}

Algorytm Wysłania (Submission Strategy):  
Kliknięcie przycisku "Wyślij" bywa zawodne. Lepszą strategią jest symulacja wciśnięcia klawisza ENTER.  
Większość czatbotów nasłuchuje na zdarzenie keydown z kodem 13 (Enter) wewnątrz pola tekstowego.  
Ważne: Należy upewnić się, że nie jest wciśnięty Shift (Shift+Enter to nowa linia).

## ---

**Rozdział 7: Odporność Systemu i "Anti-Graviti Engineering"**

Termin "Anti-Graviti" w kontekście tego projektu odnosi się do budowania systemów odpornych na "siły ciążenia" korporacyjnych zmian API i UI. Jak sprawić, by wtyczka działała, gdy Google zmieni kod HTML Gemini w 2025 roku?

### **7.1 Strategie Fallback (Systemy Zapasowe)**

1. Computer Vision (Opcja Przyszłościowa):  
   Jak sugerują snippety 19, Gemini 2.5 wprowadza "Computer Use" i zdolność rozumienia interfejsu wizualnie. Chociaż w MVP tego nie zaimplementujemy, idealna wersja 2.0 rozszerzenia mogłaby (w przypadku awarii selektorów CSS) robić zrzut ekranu panelu, analizować go (np. małym modelem on-device typu TensorFlow.js lub OCR), znajdować koordynaty pola tekstowego i symulować kliknięcia myszą w konkretne piksele (document.elementFromPoint). To uczyniłoby bota niewrażliwym na zmiany nazw klas czy struktury DOM, a jedynie na zmiany wizualne.  
2. Zewnętrzna Konfiguracja Selektorów:  
   Zamiast hardkodować selektory w gemini\_driver.js, skrypt mógłby przy starcie pobierać mały plik JSON z publicznego repozytorium GitHub (np. Gist).  
   fetch('https://gist.githubusercontent.com/.../selectors.json')  
   Dzięki temu, gdy Google zmieni UI, wystarczy zaktualizować plik JSON w chmurze, a wszystkie instancje rozszerzenia u użytkowników naprawią się same przy następnym uruchomieniu, bez konieczności aktualizacji kodu wtyczki. To jest prawdziwy "hacker style" – zdalne łatkowanie w locie.

## ---

**Rozdział 8: Prywatność, Bezpieczeństwo i OpSec**

W domenie "Hacker Style" bezpieczeństwo operacyjne (OpSec) jest priorytetem. Musimy zrozumieć, jakie ślady zostawiamy.

### **8.1 Data Sovereignty (Suwerenność Danych)**

W naszej architekturze, tekst zaznaczony przez użytkownika podróżuje następującą ścieżką:  
Active Tab \-\> Extension Memory \-\> Local Storage \-\> Side Panel Iframe (Gemini).  
W żadnym punkcie dane te nie trafiają na serwer pośredniczący (3rd party server). Jedyną stroną trzecią jest Google (dostawca Gemini). Jest to maksymalny poziom prywatności możliwy do osiągnięcia przy korzystaniu z chmurowego LLM.

### **8.2 Fingerprinting i Wykrywalność**

Czy Google może wykryć, że używamy bota?

* **Analiza Zachowania:** Jeśli skrypt wklei tekst i naciśnie Enter w czasie 1 milisekundy, systemy anty-spamowe Google mogą to oflagować.  
* **Mitygacja:** W gemini\_driver.js należy zaimplementować funkcję humanDelay(), która dodaje losowe opóźnienie (np. Math.random() \* 500 \+ 200 ms) pomiędzy wklejeniem tekstu a kliknięciem przycisku wyślij. To symuluje czas reakcji człowieka.  
* **Analiza User-Agent:** Ponieważ używamy iframe wewnątrz Chrome, User-Agent jest zgodny z naszą przeglądarką. Nie wyglądamy jak skrypt Pythona (Selenium/Puppeteer), który często ma specyficzne nagłówki. Wyglądamy jak natywny użytkownik Chrome.

### **8.3 Izolacja Sesji**

Rozszerzenie korzysta z ciasteczek (Cookies) przeglądarki. Jeśli użytkownik jest zalogowany w Chrome na swoje konto Google, Gemini w panelu bocznym otworzy się od razu zalogowane.  
Zaleta: Wygoda. Zero konfiguracji.  
Ryzyko: Jeśli ktoś przejmie komputer i otworzy panel, ma dostęp do historii czatów. Jednak ryzyko to jest tożsame z wejściem na gemini.google.com w zwykłej karcie.

## ---

**Rozdział 9: Instrukcja dla Agenta Kodującego (Prompt Finalny)**

Poniżej znajduje się skondensowana, techniczna instrukcja, którą należy przekazać agentowi AI (np. Antigraviti, Cursor, Windsurf) w celu wygenerowania kodu. Jest to "destylat" powyższego raportu.

---

Rola: Senior Chrome Extension Developer (Manifest V3 Expert).  
Zadanie: Stworzenie kompletnego kodu MVP dla rozszerzenia "Gemini-Bridge".  
Kontekst: Narzędzie prywatne, "hacker style", brak zewnętrznych bibliotek.  
**Wymagana Struktura Plików i Logika:**

1. **manifest.json**:  
   * Wersja: 3\.  
   * permissions: sidePanel, storage, contextMenus, declarativeNetRequest.  
   * host\_permissions: https://gemini.google.com/\* (Krytyczne dla wstrzykiwania).  
   * content\_scripts: Musi zawierać wpis dla gemini\_driver.js pasujący do https://gemini.google.com/\* z flagą "all\_frames": true.  
   * declarative\_net\_request: Wskazanie na rules.json.  
   * side\_panel: default\_path: sidepanel.html.  
2. **rules.json**:  
   * Reguła typu modifyHeaders.  
   * Akcja: remove dla nagłówków X-Frame-Options oraz Content-Security-Policy.  
   * Warunek: urlFilter: ||gemini.google.com, resourceTypes: \["sub\_frame"\].  
3. **background.js (Service Worker)**:  
   * chrome.runtime.onInstalled: Utwórz menu kontekstowe (id: "send-to-gemini", title: "Ask Gemini: %s", contexts: \["selection"\]).  
   * chrome.contextMenus.onClicked:  
     1. Pobierz zaznaczony tekst.  
     2. Zapisz go w chrome.storage.local jako { prompt: text, timestamp: Date.now() }.  
     3. Otwórz panel: chrome.sidePanel.open({ tabId: tab.id }).  
4. **sidepanel.html**:  
   * Styl: body { margin: 0; padding: 0; height: 100vh; overflow: hidden; }.  
   * Element: \<iframe src="https://gemini.google.com/app" style="width:100%; height:100%; border:none;"\>\</iframe\>.  
   * Brak skryptów JS w samym HTML (logika jest w content scripcie iframe'a).  
5. **gemini\_driver.js (Content Script)**:  
   * Uruchamia się wewnątrz iframe'a.  
   * Funkcja injectPrompt(text):  
     * Znajdź pole: div\[contenteditable="true"\] (priorytet) LUB div\[role="textbox"\].  
     * Focus na pole.  
     * Wyczyść pole (opcjonalnie).  
     * Wstaw tekst: document.execCommand('insertText', false, text);.  
     * Znajdź przycisk Send: button LUB button.  
     * Kliknij przycisk (z opóźnieniem 300ms dla naturalności).  
   * Logika nasłuchu:  
     * Na starcie sprawdź chrome.storage.local. Jeśli jest świeży prompt (timestamp \< 1 min), wykonaj injectPrompt i wyczyść storage.  
     * Nasłuchuj zmian: chrome.storage.onChanged.addListener. Jeśli nadejdzie nowy prompt, wykonaj injectPrompt.

**Ograniczenia:**

* Kod ma być czysty (ES6+), z komentarzami.  
* Obsługa błędów: Jeśli selektor nie znajdzie elementu, wypisz w konsoli Error: Selector failed i ponów próbę 3 razy co 1 sekundę.

## ---

---

**Rozdział 10: Podsumowanie i Wnioski Końcowe**

Przedstawiona specyfikacja "Web Automation Bridge" jest kompleksowym planem działania, który zamienia ograniczenia Manifest V3 w atuty. Poprzez wykorzystanie declarativeNetRequest do manipulacji nagłówkami bezpieczeństwa oraz natywnego API sidePanel, tworzymy narzędzie, które integruje się z systemem operacyjnym przeglądarki głębiej niż jakakolwiek standardowa wtyczka ze sklepu.

Podejście to wymaga dyscypliny (ręczna aktualizacja selektorów), ale w zamian oferuje:

1. **Całkowitą prywatność** (brak pośredników).  
2. **Brak kosztów subskrypcyjnych** (korzystanie z darmowego interfejsu webowego).  
3. **Pełną kontrolę nad środowiskiem** (kod jest otwarty i lokalny).

Jest to esencja podejścia "Partnerka" – pragmatyczne, technicznie zaawansowane rozwiązanie problemu, które stawia autonomię użytkownika (Ciebie, Pawle) ponad wygodę gotowych, śledzących rozwiązań komercyjnych. Jesteśmy gotowi do przejścia do fazy kodowania.

#### ---

**Cytowane prace**

1. luyu0279/BrainyAI: a free and open-source browser sidebar plugin that offers a cost-free alternative to products like Sider, Monica, and Merlin. \- GitHub, otwierano: grudnia 14, 2025, [https://github.com/luyu0279/BrainyAI](https://github.com/luyu0279/BrainyAI)  
2. xiaolai/insidebar-ai: A browser extension for Chrome/Edge \- GitHub, otwierano: grudnia 14, 2025, [https://github.com/xiaolai/insidebar-ai](https://github.com/xiaolai/insidebar-ai)  
3. How to open external url in chrome extension side panel \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/76890977/how-to-open-external-url-in-chrome-extension-side-panel](https://stackoverflow.com/questions/76890977/how-to-open-external-url-in-chrome-extension-side-panel)  
4. chrome.sidePanel | API \- Chrome for Developers, otwierano: grudnia 14, 2025, [https://developer.chrome.com/docs/extensions/reference/api/sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)  
5. 20 Understanding Chrome Extensions Side Panel | by M2K Developments \- Medium, otwierano: grudnia 14, 2025, [https://m2kdevelopments.medium.com/20-understanding-chrome-extensions-side-panel-334ef5de7cfd](https://m2kdevelopments.medium.com/20-understanding-chrome-extensions-side-panel-334ef5de7cfd)  
6. The Complete Guide to Migrating Chrome Extensions from Manifest V2 to Manifest V3, otwierano: grudnia 14, 2025, [https://hackernoon.com/the-complete-guide-to-migrating-chrome-extensions-from-manifest-v2-to-manifest-v3](https://hackernoon.com/the-complete-guide-to-migrating-chrome-extensions-from-manifest-v2-to-manifest-v3)  
7. Collaborate with Gemini in Google Sheets (Workspace Labs) \- Google Docs Editors Help, otwierano: grudnia 14, 2025, [https://support.google.com/docs/answer/14218565?hl=en](https://support.google.com/docs/answer/14218565?hl=en)  
8. Read Practical AI with Google: A Solo Knowledge Worker's Guide to Gemini, AI Studio, and LLM APIs | Leanpub, otwierano: grudnia 14, 2025, [https://leanpub.com/solo-ai/read](https://leanpub.com/solo-ai/read)  
9. Recently Active 'chrome-extension-manifest-v3' Questions \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/tagged/chrome-extension-manifest-v3?tab=Active](https://stackoverflow.com/questions/tagged/chrome-extension-manifest-v3?tab=Active)  
10. Newest 'chrome-extension-manifest-v3' Questions \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/tagged/chrome-extension-manifest-v3](https://stackoverflow.com/questions/tagged/chrome-extension-manifest-v3)  
11. Manifest V3: Web Request Changes \- Google Groups, otwierano: grudnia 14, 2025, [https://groups.google.com/a/chromium.org/g/chromium-extensions/c/veJy9uAwS00/m/5V6Upq\_YBAAJ](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/veJy9uAwS00/m/5V6Upq_YBAAJ)  
12. Gemini 2.5 Computer Use: Marketing Automation Guide, otwierano: grudnia 14, 2025, [https://www.digitalapplied.com/blog/gemini-2-5-computer-use-marketing-automation](https://www.digitalapplied.com/blog/gemini-2-5-computer-use-marketing-automation)  
13. Gemini 2.0 UI Automation: A Practical Guide to Intelligent Screen Control \- Medium, otwierano: grudnia 14, 2025, [https://medium.com/@alan.b.newcomer/gemini-2-0-ui-automation-a-practical-guide-to-intelligent-screen-control-7457024d4f22](https://medium.com/@alan.b.newcomer/gemini-2-0-ui-automation-a-practical-guide-to-intelligent-screen-control-7457024d4f22)  
14. Why Gemini Web Chat is much better than Gemini API? | by Eric Popivker | ENTech Solutions | Medium, otwierano: grudnia 14, 2025, [https://medium.com/entech-solutions/why-gemini-web-chat-is-much-better-than-gemini-api-68a5d19f301f](https://medium.com/entech-solutions/why-gemini-web-chat-is-much-better-than-gemini-api-68a5d19f301f)  
15. Multi-Platform AI Prompt Manager \- Source code \- Greasy Fork, otwierano: grudnia 14, 2025, [https://greasyfork.org/en/scripts/546101-multi-platform-ai-prompt-manager/code](https://greasyfork.org/en/scripts/546101-multi-platform-ai-prompt-manager/code)  
16. Auto RTL Input \- Source code \- Greasy Fork, otwierano: grudnia 14, 2025, [https://greasyfork.org/en/scripts/543234-auto-rtl-input/code](https://greasyfork.org/en/scripts/543234-auto-rtl-input/code)  
17. kalivaraprasad-gonapa/gemini-scrap: scrapping bookmyshow with gemini \- GitHub, otwierano: grudnia 14, 2025, [https://github.com/kalivaraprasad-gonapa/gemini-scrap](https://github.com/kalivaraprasad-gonapa/gemini-scrap)  
18. Connecting to Gemini Web Chat using Selenium in Python \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/78236002/connecting-to-gemini-web-chat-using-selenium-in-python](https://stackoverflow.com/questions/78236002/connecting-to-gemini-web-chat-using-selenium-in-python)  
19. Computer Use | Gemini API | Google AI for Developers, otwierano: grudnia 14, 2025, [https://ai.google.dev/gemini-api/docs/computer-use](https://ai.google.dev/gemini-api/docs/computer-use)  
20. Skyvern-AI/skyvern: Automate browser based workflows with AI \- GitHub, otwierano: grudnia 14, 2025, [https://github.com/Skyvern-AI/skyvern](https://github.com/Skyvern-AI/skyvern)  
21. Intelligent UI testing with Gemini: Redefining mobile app quality assurance with GenAI, otwierano: grudnia 14, 2025, [https://discuss.google.dev/t/intelligent-ui-testing-with-gemini-redefining-mobile-app-quality-assurance-with-genai/295379](https://discuss.google.dev/t/intelligent-ui-testing-with-gemini-redefining-mobile-app-quality-assurance-with-genai/295379)