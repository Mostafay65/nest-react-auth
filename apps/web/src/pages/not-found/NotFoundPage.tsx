import { Link } from 'react-router';
import { paths } from '@/shared/paths';
import { Spread } from '@/shared/ui/Spread';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <Spread index="404" title="Not in the index." lede="There is no page at this address.">
      <title>Page not found · Auth Module</title>
      <p className={styles.onward}>
        <Link to={paths.home}>Go to the start</Link>
      </p>
    </Spread>
  );
}
