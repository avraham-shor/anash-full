import styles from "../App.module.css";

export function ButtonGoToMenu() {
    const hideButton = window.location.pathname === "/" || window.location.pathname.length === 0;
    if (hideButton) return null;
    return (
        <div className={styles.navButtons}>
            <button onClick={goToMenu} className={styles.backButton}>חזרה לתפריט הראשי</button>
        </div>
    );
}

function goToMenu() {
    window.location.href = "/";
}