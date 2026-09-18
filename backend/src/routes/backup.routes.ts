import { Router } from 'express';
import { listBackups, createBackup, deleteBackup, openFolder, restoreBackup, downloadBackup, getSettings, updateSettings } from '../controllers/backup.controller';

const router = Router();

router.get('/settings', getSettings);
router.post('/settings', updateSettings);
router.get('/', listBackups);
router.post('/', createBackup);
router.get('/download/:filename', downloadBackup);
router.delete('/:filename', deleteBackup);
router.post('/open-folder', openFolder);
router.post('/restore', restoreBackup);

export default router;
