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
# **Raport Techniczny: Architektura i Implementacja Inteligentnych Akcji Kontekstowych w Ekosystemie Chrome Manifest V3**

## **Streszczenie Wykonawcze**

Transformacja ekosystemu rozszerzeń przeglądarki Chrome z Manifest V2 (MV2) na Manifest V3 (MV3) wymusiła fundamentalną zmianę w paradygmacie projektowania aplikacji klienckich. Wprowadzenie efemerycznych Service Workerów w miejsce trwałych stron tła (background pages) oraz rygorystyczne zasady dotyczące bezpieczeństwa i wydajności stworzyły nowe wyzwania dla deweloperów, ale jednocześnie otworzyły drogę do bardziej zintegrowanych interfejsów użytkownika, takich jak Panel Boczny (Side Panel). W niniejszym raporcie przedstawiono wyczerpującą analizę techniczną implementacji "Inteligentnych Akcji" – takich jak weryfikacja faktów, wyjaśnianie pojęć i auto-analiza – bezpośrednio z poziomu menu kontekstowego, eliminując przestarzały model "kopiuj-wklej".

Raport ten, przeznaczony dla architektów oprogramowania i inżynierów systemów webowych, dekonstruuje złożoność interakcji między API chrome.contextMenus a chrome.sidePanel, rozwiązuje krytyczny problem "gestu użytkownika" (user gesture) w środowisku asynchronicznym oraz proponuje zaawansowane ramy inżynierii promptów (prompt engineering) oparte na technikach Chain-of-Thought i Meta-Prompting. Celem jest dostarczenie kompletnego planu wdrożenia systemu, który przekształca przeglądarkę z pasywnego narzędzia do konsumpcji treści w aktywnego, inteligentnego asystenta analitycznego.

## ---

**1\. Ewolucja Architektury Rozszerzeń: Od Trwałości do Efemeryczności**

### **1.1 Śmierć Stron Tła i Narodziny Service Workerów**

Podstawą każdego nowoczesnego rozszerzenia w Manifest V3 jest Service Worker. W przeciwieństwie do modelu MV2, gdzie skrypty tła mogły działać nieprzerwanie, utrzymując stan w zmiennych globalnych, Service Workery w MV3 są z definicji krótkotrwałe i sterowane zdarzeniami.1 To przejście architektoniczne ma głębokie implikacje dla funkcji "Inteligentnych Akcji". Gdy użytkownik klika "Zweryfikuj" w menu kontekstowym, Service Worker budzi się, przetwarza zdarzenie onClicked, a następnie może zostać natychmiast uśpiony przez przeglądarkę, jeśli nie zostaną podjęte odpowiednie środki przedłużające jego cykl życia.2

Implikuje to, że każda "Inteligentna Akcja" musi być zaprojektowana jako proces bezstanowy lub polegający na zewnętrznym magazynie stanu (state persistence). Nie możemy polegać na tym, że zmienna let currentAnalysis \=... przetrwa między kliknięciem a wyrenderowaniem wyniku w panelu bocznym. Zamiast tego, architektura musi opierać się na asynchronicznych wzorcach komunikacji i trwałym magazynowaniu danych, wykorzystując chrome.storage.session jako most między efemerycznym workerem a interfejsem użytkownika.3

### **1.2 Nowy Standard Interfejsu: Side Panel API**

Tradycyjne podejście do wyświetlania wyników analizy w rozszerzeniach opierało się na wyskakujących oknach (Popups), które zamykały się po utracie fokusa, lub na wstrzykiwaniu elementów DOM (Content Scripts), co często prowadziło do konfliktów CSS ze stroną hosta. Manifest V3 promuje chrome.sidePanel jako dedykowane rozwiązanie dla trwałych, pomocniczych interfejsów.4 Panel boczny umożliwia użytkownikowi jednoczesne przeglądanie treści źródłowej i wyników analizy AI, co jest kluczowe dla zadań weryfikacyjnych i edukacyjnych.

Jednakże, integracja Panelu Bocznego z Menu Kontekstowym w MV3 jest obarczona specyficznymi ograniczeniami bezpieczeństwa, znanymi jako wymóg "gestu użytkownika" (User Gesture Requirement). Przeglądarka Chrome, w celu ochrony przed spamem i niechcianymi zachowaniami, pozwala na programowe otwarcie panelu bocznego (chrome.sidePanel.open) tylko w bezpośredniej odpowiedzi na interakcję użytkownika.4 Jak wykazują liczne analizy przypadków, asynchroniczna natura komunikacji między procesami w Chrome często powoduje "zgubienie" tokenu gestu, co prowadzi do błędów implementacyjnych.6 Rozwiązanie tego problemu stanowi jeden z głównych filarów proponowanej architektury.

## ---

**2\. Architektura Menu Kontekstowego w Manifest V3**

Menu kontekstowe jest głównym punktem wejścia dla "Inteligentnych Akcji". W MV3 API chrome.contextMenus zachowuje większość funkcjonalności z MV2, ale zmienia sposób inicjalizacji i obsługi zdarzeń.

### **2.1 Strategia Inicjalizacji i Hierarchia**

Ze względu na efemeryczną naturę Service Workera, menu kontekstowe muszą być tworzone wewnątrz zdarzenia chrome.runtime.onInstalled. Utworzenie ich poza tym listenerem może prowadzić do błędów duplikacji id przy każdym wybudzeniu workera lub, w przeciwnym wypadku, do ich braku po restarcie przeglądarki.2

Aby uniknąć zaśmiecania głównego menu kontekstowego przeglądarki (co jest ograniczone limitem ACTION\_MENU\_TOP\_LEVEL\_LIMIT), konieczne jest zastosowanie hierarchicznej struktury zagnieżdżonej.8

**Rekomendowana Taksonomia Menu:**

| Poziom | ID Elementu | Typ | Kontekst | Opis |
| :---- | :---- | :---- | :---- | :---- |
| **Root** | ai\_root | normal | selection | Główny kontener "Inteligentny Asystent". Widoczny tylko przy zaznaczeniu tekstu. |
| **Poziom 1** | act\_verify | normal | selection | "Zweryfikuj fakty" – Uruchamia protokół fact-checkingu. |
| **Poziom 1** | act\_explain | normal | selection | "Wyjaśnij to" – Uruchamia moduł eksplikacyjny. |
| **Poziom 2** | expl\_simple | normal | selection | "Wyjaśnij jak 5-latkowi (ELI5)" – Podmenu dla uproszczeń. |
| **Poziom 2** | expl\_tech | normal | selection | "Analiza techniczna" – Podmenu dla głębszej analizy. |
| **Poziom 1** | act\_analyze | normal | selection | "Auto-analiza" – Generuje wglądy drugiego rzędu. |

Taka struktura, zdefiniowana przy użyciu właściwości parentId 9, zapewnia czystość interfejsu i pozwala na logiczne grupowanie promptów.

### **2.2 Wyzwanie Dynamicznego Menu**

Użytkownik zapytał o "dynamiczne menu". W idealnym scenariuszu menu zmieniałoby się w zależności od treści zaznaczenia (np. pokazywanie opcji "Analizuj kod" tylko gdy zaznaczono fragment JavaScript). W MV3 jest to trudne do osiągnięcia w czasie rzeczywistym.

W starym modelu MV2, zdarzenia tła mogły szybko analizować zaznaczenie. W MV3, aby zaktualizować menu *przed* kliknięciem, należałoby nasłuchiwać zmian zaznaczenia w skrypcie treści (Content Script), przesyłać wiadomość do Service Workera i wywoływać chrome.contextMenus.update. Jest to operacja kosztowna obliczeniowo i generująca duży ruch między procesami (messaging overhead).

Rekomendowane Podejście Hybrydowe:  
Zamiast ciągłej aktualizacji menu, zaleca się stworzenie statycznej, szerokiej struktury (jak w tabeli powyżej), a "dynamikę" przenieść do momentu wykonania (post-click).

1. Użytkownik klika generyczną akcję (np. "Wyjaśnij").  
2. Service Worker pobiera tekst.  
3. Prompt systemowy AI (System Prompt) dokonuje klasyfikacji: "To jest kod Python" lub "To jest tekst prawniczy".  
4. Na podstawie klasyfikacji, AI dobiera odpowiedni szablon odpowiedzi (np. szukanie błędów składniowych vs. tłumaczenie żargonu prawnego).

To podejście "Late Binding" (późne wiązanie) jest znacznie bardziej wydajne w architekturze MV3 i eliminuje opóźnienia interfejsu.

## ---

**3\. Integracja Panelu Bocznego: Rozwiązanie Problemu Gestu Użytkownika**

Najbardziej krytycznym elementem technicznym jest niezawodne otwieranie panelu bocznego po kliknięciu w menu kontekstowe. Dokumentacja Chrome i zgłoszenia błędów 5 wskazują na częsty błąd: Error: sidePanel.open() may only be called in response to a user gesture.

### **3.1 Anatomia Problemu**

Problem wynika z mechanizmu "User Activation" w silniku Blink. Token aktywacji użytkownika jest efemeryczny. Jeśli w handlerze chrome.contextMenus.onClicked wykonamy jakąkolwiek operację asynchroniczną (np. await chrome.storage.local.get lub fetch) *przed* wywołaniem sidePanel.open, pętla zdarzeń (event loop) przejdzie do kolejnego cyklu, a token wygaśnie. Przeglądarka uzna wtedy próbę otwarcia panelu za nieautoryzowaną akcję tła.

### **3.2 Wzorzec "Optymistycznego Otwarcia" (The Optimistic Open Pattern)**

Aby zagwarantować 100% skuteczności, należy zastosować odwrócony przepływ sterowania.

**Błędny Wzorzec (Prowadzi do błędu):**

1. Odbierz kliknięcie.  
2. Pobierz dane z chrome.storage.  
3. Wyślij zapytanie do API AI.  
4. Otwórz panel, żeby pokazać wynik.  
   Wynik: Błąd User gesture required.

**Poprawny Wzorzec (Zalecany):**

1. Odbierz kliknięcie.  
2. **NATYCHMIAST** (synchronicznie) wywołaj chrome.sidePanel.open({ tabId: tab.id }).4  
3. Dopiero po zainicjowaniu otwarcia, zapisz dane kontekstowe (zaznaczony tekst, typ akcji) do chrome.storage.session.  
4. Skrypt uruchomiony wewnątrz panelu bocznego (panel.js) po załadowaniu odczytuje dane z storage i inicjuje właściwą logikę biznesową (zapytanie do AI).

### **3.3 Implementacja Mostu Danych (Data Bridge)**

Ponieważ Panel Boczny i Service Worker działają w odrębnych kontekstach pamięci, konieczne jest medium wymiany danych. chrome.storage.session jest idealnym kandydatem, ponieważ dane są przechowywane w pamięci RAM (szybki dostęp), nie są persistowane na dysku (bezpieczeństwo danych użytkownika), i są dostępne dla obu kontekstów.3

JavaScript

// Service Worker (background.js)  
chrome.contextMenus.onClicked.addListener((info, tab) \=\> {  
    // KROK 1: Otwórz panel natychmiastowo.  
    // Ignorujemy błędy, jeśli panel jest już otwarty, ale musimy ponowić próbę.  
    chrome.sidePanel.open({ tabId: tab.id }).catch((err) \=\> console.log(err));

    // KROK 2: Przygotuj payload  
    const payload \= {  
        type: info.menuItemId, // np. 'act\_verify'  
        text: info.selectionText,  
        contextUrl: tab.url,  
        timestamp: Date.now()  
    };

    // KROK 3: Zapisz do sesji. Panel to odbierze.  
    chrome.storage.session.set({ 'active\_context\_action': payload });  
});

W skrypcie panelu bocznego (panel.js) należy nasłuchiwać zmian w magazynie:

JavaScript

// Panel Boczny (panel.js)  
chrome.storage.onChanged.addListener((changes, namespace) \=\> {  
    if (namespace \=== 'session' && changes.active\_context\_action) {  
        const actionData \= changes.active\_context\_action.newValue;  
        executeIntelligentAction(actionData); // Funkcja wywołująca AI  
    }  
});

Ten wzorzec całkowicie eliminuje problem "race condition" przy otwieraniu panelu i zapewnia płynne doświadczenie użytkownika.

## ---

**4\. Inżynieria Promptów dla Inteligentnych Akcji**

Samo przesłanie tekstu do modelu językowego (LLM) nie wystarczy, aby uzyskać wynik wysokiej jakości. Aby zastąpić "kopiuj-wklej" wartościową funkcjonalnością, wtyczka musi implementować zaawansowane szablony promptów (Prompt Templates), które strukturyzują rozumowanie modelu.

### **4.1 Teoria Promptowania w Kontekście Przeglądarki**

W środowisku przeglądarkowym mamy unikalny dostęp do metadanych: URL strony, tytuł, a nawet struktura DOM. Dobre prompty wykorzystują te informacje. Należy stosować techniki **Chain-of-Thought (CoT)** 13 oraz **Meta-Prompting** 15, aby zmusić model do głębszej analizy przed wygenerowaniem odpowiedzi.

### **4.2 Szablon 1: "Zweryfikuj" (Protokół Weryfikacji Faktów)**

Celem tej akcji jest krytyczna ocena prawdziwości zaznaczonego fragmentu. Nie wystarczy zapytać "Czy to prawda?". Należy wymusić na modelu rolę audytora.

**Szablon Prompta (Konstrukcja):**

Rola: Jesteś starszym analitykiem fact-checkingowym.  
Kontekst: Użytkownik przegląda stronę: {{URL}}.  
Tekst do analizy: {{SELECTION}}  
Instrukcje:

1. **Ekstrakcja:** Wypisz wszystkie twierdzenia faktograficzne zawarte w tekście.  
2. **Identyfikacja Założeń:** Zidentyfikuj ukryte założenia, które muszą być prawdziwe, aby tekst był prawdziwy.17  
3. **Weryfikacja:** Dla każdego twierdzenia oceń jego wiarygodność na podstawie swojej wiedzy wewnętrznej. Oznacz jako:,,.  
4. **Analiza Logiczna:** Wskaż błędy poznawcze (np. dowód anegdotyczny, fałszywa dychotomia).  
5. **Werdykt:** Krótkie podsumowanie dla użytkownika.

Taka struktura, wymuszająca krok po kroku ("Let's think step by step" 18), znacząco redukuje halucynacje modelu.

### **4.3 Szablon 2: "Wyjaśnij" (Dynamiczna Adaptacja)**

Tutaj kluczowa jest adaptacja do poziomu odbiorcy. Wtyczka powinna oferować warianty wyjaśnienia.

**Szablon Prompta (ELI5 \- Wyjaśnij jak 5-latkowi):**

Rola: Nauczyciel w szkole podstawowej.  
Tekst: {{SELECTION}}  
Zadanie: Wyjaśnij ten koncept używając analogii z życia codziennego. Używaj tylko 1000 najpopularniejszych słów. Maksymalnie 3 zdania..19

**Szablon Prompta (Techniczny/Sokratyczny):**

Rola: Profesor uniwersytecki.  
Tekst: {{SELECTION}}  
Zadanie: Nie podawaj gotowej odpowiedzi. Zadaj użytkownikowi 3 pytania naprowadzające, które pomogą mu zrozumieć ten mechanizm samodzielnie, a następnie podaj techniczną definicję.

### **4.4 Szablon 3: "Auto-analiza" (Meta-Prompting i Wglądy Drugiego Rzędu)**

Ta akcja ma na celu wydobycie informacji, których nie widać na pierwszy rzut oka. Wykorzystujemy tu technikę "Ask yourself a question".16

**Szablon Prompta:**

Rola: Strateg biznesowy i psycholog.  
Tekst: {{SELECTION}}  
Instrukcja Meta-kognitywna:  
Najpierw wygeneruj 3 krytyczne pytania, które sceptyk zadałby temu tekstowi.  
Następnie odpowiedz na te pytania.  
Na koniec stwórz "Macierz Konsekwencji":

* Co się stanie natychmiast, jeśli to prawda?  
* Jakie będą długoterminowe skutki drugiego rzędu?  
* Kto zyskuje (Cui bono), a kto traci na tej narracji?

### **4.5 Egzekwowanie Formatu Wyjściowego (JSON Enforcement)**

Aby interfejs panelu bocznego był czytelny (używał ikonek, tabel, kolorów), odpowiedź AI nie może być czystym tekstem. Należy wymusić format JSON w prompcie systemowym.

JSON

// Oczekiwany format odpowiedzi zdefiniowany w prompcie  
{  
  "summary": "String",  
  "verdict\_score": 0-100,  
  "key\_points":,  
  "hidden\_assumptions":  
}

Dzięki temu panel boczny może renderować eleganckie karty z wynikami, zamiast ściany tekstu, co drastycznie podnosi użyteczność wtyczki.

## ---

**5\. Implementacja Techniczna Systemu Zarządzania Promptami**

W profesjonalnej inżynierii oprogramowania hardcodowanie długich stringów promptów w kodzie JavaScript jest antywzorcem. Utrudnia to utrzymanie i aktualizację logiki AI. Proponujemy architekturę "Template Engine".

### **5.1 Struktura Magazynu Szablonów**

Szablony powinny być przechowywane w osobnym pliku (np. prompts.js lub templates.json) i ładowane dynamicznie. Pozwala to w przyszłości na aktualizację promptów zdalnie (np. pobieranie ich z serwera raz dziennie), bez konieczności publikowania nowej wersji wtyczki w Chrome Web Store (o ile jest to zgodne z polityką Remote Code Execution – tutaj przesyłamy tylko dane/tekst, nie kod wykonywalny).

**Przykładowa struktura danych szablonu:**

| Pole | Typ | Opis |
| :---- | :---- | :---- |
| id | string | Unikalny identyfikator (np. verify\_claims\_v2) |
| system | string | Instrukcja systemowa definiująca rolę AI. |
| user\_template | string | Szablon z placeholderami (np. {{TEXT}}, {{URL}}). |
| parameters | object | Konfiguracja modelu (temperature, top\_k). |
| output\_schema | object | Schemat JSON do walidacji odpowiedzi. |

### **5.2 Dynamiczne Wstrzykiwanie Zmiennych**

Silnik szablonów w Service Workerze lub Panelu Bocznym musi obsługiwać wstrzykiwanie zmiennych kontekstowych.

JavaScript

function compilePrompt(templateId, contextData) {  
    const template \= PROMPT\_LIBRARY\[templateId\];  
    let compiled \= template.user\_template;

    // Podstawienie zmiennych  
    compiled \= compiled.replace('{{TEXT}}', contextData.selectionText);  
    compiled \= compiled.replace('{{URL}}', contextData.pageUrl);  
      
    // Dodatkowe konteksty, np. tytuł strony  
    compiled \= compiled.replace('{{TITLE}}', contextData.pageTitle);

    return {  
        system: template.system,  
        user: compiled,  
        config: template.parameters  
    };  
}

### **5.3 Streaming i Obsługa UX**

Modele językowe są wolne. Generowanie pełnej analizy może trwać 5-10 sekund. Dla użytkownika przyzwyczajonego do natychmiastowych akcji przeglądarki jest to wieczność. Rozwiązaniem jest **Streaming Responses**.

API większości dostawców LLM (Gemini, OpenAI) obsługuje tryb strumieniowy. Panel boczny powinien renderować odpowiedź przyrostowo.

1. Otwarcie panelu \-\> Pokazanie stanu "Szkieletu" (Skeleton Loader).  
2. Otrzymanie pierwszego tokenu \-\> Wyświetlenie tekstu.  
3. Parsowanie Markdown/JSON w locie \-\> Jeśli odpowiedź jest w JSON, strumieniowanie może być trudne (trzeba czekać na domknięcie klamry).  
   * *Rozwiązanie:* Dla prostych wyjaśnień używać strumieniowania Markdown. Dla "Auto-analizy" (strukturalnej) używać loadera z etapami postępu ("Analizuję...", "Weryfikuję...", "Generuję raport...").

## ---

**6\. Bezpieczeństwo i Prywatność w Manifest V3**

Implementacja "Inteligentnych Akcji" wiąże się z przetwarzaniem danych użytkownika (zaznaczony tekst) przez zewnętrzne API. Rodzi to implikacje bezpieczeństwa, które muszą być zaadresowane zgodnie z wymogami Chrome Web Store.

### **6.1 Content Security Policy (CSP)**

Manifest V3 narzuca rygorystyczne CSP. Nie można ładować zewnętrznych skryptów (np. SDK z CDN). Wszystkie biblioteki (np. klient API Gemini, biblioteka renderowania Markdown) muszą być zbundlowane (bundled) wewnątrz paczki rozszerzenia.21

Dodatkowo, renderowanie odpowiedzi AI (która może zawierać HTML) w panelu bocznym stwarza ryzyko XSS (Cross-Site Scripting). Jeśli AI wygeneruje złośliwy skrypt \<script\>alert(1)\</script\>, a panel go wyrenderuje, może dojść do przejęcia sesji rozszerzenia.

* **Wymóg:** Zawsze używać biblioteki sanityzującej, takiej jak DOMPurify, przed wstrzyknięciem odpowiedzi AI do DOM panelu bocznego (innerHTML).

### **6.2 Zarządzanie Kluczami API**

Istnieją dwa modele dystrybucji:

1. **Własny Backend (Proxy):** Rozszerzenie wysyła zapytanie do twojego serwera, który przechowuje klucz API i komunikuje się z LLM. Jest to najbezpieczniejsze, ale kosztowne dla dewelopera.  
2. **Bring Your Own Key (BYOK):** Użytkownik podaje własny klucz API (np. OpenAI/Gemini) w ustawieniach wtyczki.  
   * Klucz musi być przechowywany w chrome.storage.sync (szyfrowany w profilu użytkownika Google), a nigdy w localStorage (który jest dostępny dla skryptów strony w niektórych konfiguracjach) lub w kodzie źródłowym.

### **6.3 Prywatność Danych (Data Sovereignty)**

Wysyłanie zaznaczonego tekstu do chmury (Google/OpenAI) może naruszać polityki firmowe w niektórych organizacjach.

* **Future-Proofing:** Chrome rozwija API window.ai (Nano Gemini), które pozwoli na uruchamianie modeli LLM *lokalnie* na urządzeniu użytkownika.  
* **Rekomendacja Architektoniczna:** Należy zaprojektować warstwę abstrakcji dla klienta AI (AIClientInterface). Dzięki temu, gdy window.ai stanie się stabilne, można będzie przełączyć "Providera" z CloudGemini na LocalGemini bez zmiany logiki menu kontekstowego. Zapewni to 100% prywatność (tekst nigdy nie opuszcza komputera) i brak kosztów API.

## ---

**7\. Wnioski i Rekomendacje Wdrożeniowe**

Zastąpienie modelu "kopiuj-wklej" inteligentnymi akcjami kontekstowymi w Chrome Manifest V3 jest zadaniem złożonym inżynieryjnie, ale wykonalnym i niosącym ogromną wartość użytkową. Kluczem do sukcesu jest zrozumienie ograniczeń Service Workera i specyfiki interakcji z Panelem Bocznym.

**Podsumowanie kluczowych rekomendacji:**

1. **Struktura:** Użyj zagnieżdżonego menu kontekstowego zdefiniowanego w onInstalled.  
2. **Interfejs:** Wykorzystaj chrome.sidePanel jako główny interfejs wyjściowy, preferując go nad wyskakującymi oknami.  
3. **Niezawodność:** Zastosuj wzorzec "Optymistycznego Otwarcia" (synchroniczne open, asynchroniczne dane) w obsłudze zdarzeń kliknięcia, aby ominąć problemy z gestem użytkownika.  
4. **Komunikacja:** Użyj chrome.storage.session jako głównego kanału przekazywania stanu między efemerycznym tłem a panelem.  
5. **Inteligencja:** Zastosuj techniki Chain-of-Thought i Meta-Prompting w szablonach, aby zapewnić głębię analizy wykraczającą poza proste podsumowania.  
6. **Bezpieczeństwo:** Sanityzuj każde wyjście z modelu AI i przygotuj architekturę pod lokalne modele offline (On-Device AI).

Wdrożenie tej architektury pozwoli na stworzenie narzędzia, które nie tylko usprawnia pracę, ale staje się integralnym, inteligentnym elementem procesów poznawczych użytkownika podczas przeglądania sieci.

## ---

**Aneks: Tabele Referencyjne i Zestawienia Danych**

### **Tabela 1: Porównanie Strategii Zarządzania Stanem w MV3**

| Metoda | Dostępność w SW | Dostępność w Panelu | Trwałość | Zastosowanie w "Inteligentnych Akcjach" |
| :---- | :---- | :---- | :---- | :---- |
| Global Variables | Tak (krótko) | Nie | Brak (reset przy uśpieniu) | Nieprzydatne. Unikać. |
| chrome.storage.local | Tak | Tak | Trwała (Dysk) | Zapisywanie historii analiz, ustawień użytkownika, kluczy API. |
| chrome.storage.session | Tak | Tak | Sesja przeglądarki (RAM) | **Idealne.** Przekazywanie zaznaczonego tekstu i wyników analizy. Szybkie i bezpieczne. |
| URL Parameters | Nie dotyczy | Tak | Brak | Można przekazać proste flagi przy otwieraniu panelu, ale limit znaków URL wyklucza przesyłanie długich tekstów. |

### **Tabela 2: Matryca Doboru Parametrów Modelu (Gemini/GPT) dla Różnych Akcji**

| Typ Akcji | Temperatura (Temperature) | Top-K | Rationale (Uzasadnienie) |
| :---- | :---- | :---- | :---- |
| **Zweryfikuj (Fact-Check)** | 0.0 \- 0.2 | 10 | Wymaga maksymalnego determinizmu i trzymania się faktów. Kreatywność jest tu błędem (halucynacją). |
| **Wyjaśnij (Explain)** | 0.4 \- 0.5 | 40 | Balans między precyzją a płynnością językową. Pozwala na użycie analogii dydaktycznych. |
| **Auto-analiza (Analyze)** | 0.7 \- 0.8 | 40 | Wysoka temperatura sprzyja generowaniu "out-of-the-box" skojarzeń i identyfikacji nieoczywistych powiązań (myślenie lateralne). |
| **Kod (Code Audit)** | 0.1 | 10 | Kod wymaga precyzji syntaktycznej. Kreatywność prowadzi do błędów składniowych. |

### **Tabela 3: Analiza Ograniczeń API chrome.contextMenus**

| Ograniczenie | Wartość | Implikacja dla Projektu |
| :---- | :---- | :---- |
| ACTION\_MENU\_TOP\_LEVEL\_LIMIT | 6 | Nie możemy dodać 10 akcji do głównego menu. Musimy używać podmenu (parentId). |
| MAX\_SUGGESTED\_ITEMS | \-- | Choć dokumentacja nie podaje sztywnego limitu, UX zaleca max 5-7 elementów w podmenu, aby uniknąć przeciążenia poznawczego. |
| Updates | Asynchroniczne | Aktualizacja tytułu menu na podstawie tekstu (np. "Analizuj: \[pierwsze 5 słów...\]") jest możliwa, ale może mieć opóźnienie. Lepiej używać statycznych tytułów. |

### **Tabela 4: Przegląd Błędów i Rozwiązań (Troubleshooting)**

| Komunikat Błędu | Przyczyna Techniczna | Rozwiązanie |
| :---- | :---- | :---- |
| sidePanel.open() may only be called in response to a user gesture | Utrata tokenu aktywacji przez await lub callback. | Przesunięcie wywołania open() na sam początek funkcji handlera (przed jakimkolwiek await). 5 |
| Cannot create item with duplicate id | Ponowne wywołanie create() przy wybudzeniu SW. | Umieszczenie create() wyłącznie wewnątrz runtime.onInstalled lub sprawdzanie chrome.runtime.lastError. 7 |
| Unchecked runtime.lastError: The message port closed before a response was received | Asynchroniczny handler wiadomości nie zwrócił true. | Jeśli używasz sendMessage, upewnij się, że handler zwraca return true; jeśli odpowiedź jest asynchroniczna. |

### **Tabela 5: Zalecany Stos Technologiczny dla Szablonów Promptów**

| Komponent | Funkcja | Przykład Narzędzia/Biblioteki |
| :---- | :---- | :---- |
| **System Szablonów** | Interpolacja zmiennych do stringów. | Mustache.js lub proste literały szablonów JS (ES6 Template Literals) dla mniejszego narzutu (bundle size). |
| **Walidacja Wyjścia** | Sprawdzanie czy JSON z AI jest poprawny. | Zod lub AJV. Niezbędne, by UI się nie rozsypało przy błędzie modelu. |
| **Sanityzacja** | Czyszczenie HTML z markdowna. | DOMPurify. Krytyczne dla bezpieczeństwa. |
| **Markdown Rendering** | Konwersja Markdown na HTML w panelu. | marked lub markdown-it. |

#### **Cytowane prace**

1. 4 Understanding Chrome Extensions Background Scripts | by M2K Developments \- Medium, otwierano: grudnia 14, 2025, [https://m2kdevelopments.medium.com/4-understanding-chrome-extensions-background-scripts-a28dc496b434](https://m2kdevelopments.medium.com/4-understanding-chrome-extensions-background-scripts-a28dc496b434)  
2. Build a context menu \- Chrome for Developers, otwierano: grudnia 14, 2025, [https://developer.chrome.com/docs/extensions/develop/ui/context-menu](https://developer.chrome.com/docs/extensions/develop/ui/context-menu)  
3. How to use localStorage or an alternative in Manifest v3 \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/70704283/how-to-use-localstorage-or-an-alternative-in-manifest-v3](https://stackoverflow.com/questions/70704283/how-to-use-localstorage-or-an-alternative-in-manifest-v3)  
4. chrome.sidePanel | API \- Chrome for Developers, otwierano: grudnia 14, 2025, [https://developer.chrome.com/docs/extensions/reference/api/sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)  
5. chrome.sidePanel.open user gesture error \- Google Groups, otwierano: grudnia 14, 2025, [https://groups.google.com/a/chromium.org/g/chromium-extensions/c/d5ky9SiZlqQ](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/d5ky9SiZlqQ)  
6. why we could not open chrome side panel when clicking a context menu item?, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/79240465/why-we-could-not-open-chrome-side-panel-when-clicking-a-context-menu-item](https://stackoverflow.com/questions/79240465/why-we-could-not-open-chrome-side-panel-when-clicking-a-context-menu-item)  
7. Add a Context Menu Item to Chrome Extension \- DEV Community, otwierano: grudnia 14, 2025, [https://dev.to/franzwong/add-a-context-menu-item-to-chrome-extension-c71](https://dev.to/franzwong/add-a-context-menu-item-to-chrome-extension-c71)  
8. chrome.contextMenus | API \- Chrome for Developers, otwierano: grudnia 14, 2025, [https://developer.chrome.com/docs/extensions/reference/api/contextMenus](https://developer.chrome.com/docs/extensions/reference/api/contextMenus)  
9. Adding sub contextMenus in Google Chrome extension \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/47231953/adding-sub-contextmenus-in-google-chrome-extension](https://stackoverflow.com/questions/47231953/adding-sub-contextmenus-in-google-chrome-extension)  
10. How to make chrome.contextMenus.onClicked.addListener distinguish for different context menu ids? \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/71196911/how-to-make-chrome-contextmenus-onclicked-addlistener-distinguish-for-different](https://stackoverflow.com/questions/71196911/how-to-make-chrome-contextmenus-onclicked-addlistener-distinguish-for-different)  
11. Something strange about sidepanel.open() in response to a user gesture \- Google Groups, otwierano: grudnia 14, 2025, [https://groups.google.com/a/chromium.org/g/chromium-extensions/c/LpzS-uV\_\_6I](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/LpzS-uV__6I)  
12. How do I get access to the chrome.sidePanel API from the latest manifest v3?, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/76539413/how-do-i-get-access-to-the-chrome-sidepanel-api-from-the-latest-manifest-v3](https://stackoverflow.com/questions/76539413/how-do-i-get-access-to-the-chrome-sidepanel-api-from-the-latest-manifest-v3)  
13. What is chain of thought (CoT) prompting? \- IBM, otwierano: grudnia 14, 2025, [https://www.ibm.com/think/topics/chain-of-thoughts](https://www.ibm.com/think/topics/chain-of-thoughts)  
14. 8 Chain-of-Thought Techniques To Fix Your AI Reasoning | Galileo, otwierano: grudnia 14, 2025, [https://galileo.ai/blog/chain-of-thought-prompting-techniques](https://galileo.ai/blog/chain-of-thought-prompting-techniques)  
15. Meta Prompting | Prompt Engineering Guide, otwierano: grudnia 14, 2025, [https://www.promptingguide.ai/techniques/meta-prompting](https://www.promptingguide.ai/techniques/meta-prompting)  
16. (Failed \- but working 100%) Interview challenge : r/Python \- Reddit, otwierano: grudnia 14, 2025, [https://www.reddit.com/r/Python/comments/137gvt9/failed\_but\_working\_100\_interview\_challenge/](https://www.reddit.com/r/Python/comments/137gvt9/failed_but_working_100_interview_challenge/)  
17. Design Thinking: A Framework for Problem Solving in Entrepreneurship | ILLUMINATION \- Medium, otwierano: grudnia 14, 2025, [https://medium.com/illumination/framework-for-problem-solving-e40726c04a31](https://medium.com/illumination/framework-for-problem-solving-e40726c04a31)  
18. Chain-of-Thought Prompting | Prompt Engineering Guide, otwierano: grudnia 14, 2025, [https://www.promptingguide.ai/techniques/cot](https://www.promptingguide.ai/techniques/cot)  
19. I stopped writing long prompts for Gemini. These 50 single-line prompts get better results with 0% of the frustration \- keep it simple and get the job done right. : r/GeminiAI \- Reddit, otwierano: grudnia 14, 2025, [https://www.reddit.com/r/GeminiAI/comments/1pjmwo4/i\_stopped\_writing\_long\_prompts\_for\_gemini\_these/](https://www.reddit.com/r/GeminiAI/comments/1pjmwo4/i_stopped_writing_long_prompts_for_gemini_these/)  
20. A Marketer's Guide to AI Prompts \- BENlabs, otwierano: grudnia 14, 2025, [https://www.benlabs.com/resources/eli5-ai-prompt/](https://www.benlabs.com/resources/eli5-ai-prompt/)  
21. Chrome Extension Manifest V3 Libraries in Background \- Stack Overflow, otwierano: grudnia 14, 2025, [https://stackoverflow.com/questions/70715942/chrome-extension-manifest-v3-libraries-in-background](https://stackoverflow.com/questions/70715942/chrome-extension-manifest-v3-libraries-in-background)
