import './styles.css';
import { TriageController } from './glasses/triageController';
import { mountCompanionApp } from './ui/companionApp';

const root = document.getElementById('app');
if (root) {
  const controller = new TriageController();
  mountCompanionApp(root, controller);
  void controller.init();
}
