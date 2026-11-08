import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { bindDocumentLanguage, english, resolveLanguage, setLanguage, t } from '../src/i18n';

test('自动语言覆盖中文地区，其余语言使用英文，并尊重手动选择', () => {
  assert.equal(resolveLanguage('system', 'zh-TW'), 'zh-CN');
  assert.equal(resolveLanguage('system', 'en-US'), 'en');
  assert.equal(resolveLanguage('system', 'de-DE'), 'en');
  assert.equal(resolveLanguage('zh-CN', 'en-US'), 'zh-CN');
  assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
});

test('运行状态、带参数消息和错误详情都能切换语言', () => {
  setLanguage('en');
  assert.equal(t('播放已暂停'), 'Playback paused');
  assert.equal(t('App 当前 12 / 上限 20'), 'App intensity 12 / limit 20');
  assert.equal(t('门限 -38.0 dBFS · 关闭'), 'Gate -38.0 dBFS · Closed');
  assert.equal(t('Error: 参数 capA 必须在 0～200 之间。'), 'Error: capA must be between 0 and 200.');
  assert.equal(t('App 指令失败：设备已离线'), 'Device command failed: Device disconnected');
  assert.equal(t('MEDIA-EXAMPLE'), 'MEDIA-EXAMPLE');
  setLanguage('zh-CN');
  assert.equal(t('播放已暂停'), '播放已暂停');
});

test('完整控制台静态文案有英文翻译，切换语言不重建输入框或更改数值', () => {
  const dom = new JSDOM(readFileSync('src/ui.html', 'utf8'));
  const document = dom.window.document;
  const apply = bindDocumentLanguage(document);
  const input = document.querySelector<HTMLInputElement>('input[name=capA]')!;
  input.value = '17';
  setLanguage('en'); apply();
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.title, 'Coyote Audio Link');
  assert.equal(document.querySelector('#start')!.textContent, 'Enable Audio Link');
  const texts = document.body.textContent!.replace(/简体中文/g, '');
  assert.equal(/[\u3400-\u9fff]/.test(texts), false, texts);
  assert.equal(input.value, '17');
  setLanguage('zh-CN'); apply();
  assert.equal(document.querySelector('#start')!.textContent, '开始联动');
  assert.equal(document.querySelector('input[name=capA]'), input);
  assert.equal(input.value, '17');
  dom.window.close();
});

test('英文词典完整且模板占位符与原文一致', () => {
  for (const [source, translated] of Object.entries(english)) {
    assert.ok(translated.trim(), source);
    assert.deepEqual(source.match(/\{\w+\}/g)?.sort() || [], translated.match(/\{\w+\}/g)?.sort() || [], source);
  }
});
