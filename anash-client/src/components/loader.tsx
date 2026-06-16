import styles from './loader.module.css';

interface LoaderProps {
    text?: string;
}

export function Loader({ text = 'טוען נתונים...' }: LoaderProps) {
    return (
        <div className={styles.loaderWrap}>
            <div className={styles.loaderCard}>
                <div className={styles.dots}>
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                    <span className={styles.dot} />
                </div>
                <p className={styles.loaderText}>{text}</p>
            </div>
        </div>
    );
}
