const themeButton =
    document.getElementById("btnTheme");

const THEME_KEY =
    "secure-theme";


function applyTheme(theme) {

    const isLight =
        theme === "light";

    document.body.classList.toggle(
        "light-theme",
        isLight
    );

    localStorage.setItem(
        THEME_KEY,
        isLight ? "light" : "dark"
    );
}


const savedTheme =
    localStorage.getItem(
        THEME_KEY
    ) || "dark";


applyTheme(savedTheme);


themeButton?.addEventListener(
    "click",
    () => {

        const nextTheme =
            document.body.classList.contains(
                "light-theme"
            )
                ? "dark"
                : "light";

        applyTheme(nextTheme);

    }
);