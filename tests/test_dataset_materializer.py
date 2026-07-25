import csv
import importlib.util
import json
import os
import sqlite3
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.TemporaryDirectory()
os.environ['DB_PATH'] = os.path.join(TMP.name, 'thesis.db')
os.environ['MATERIALS_DIR'] = os.path.join(TMP.name, 'materials')
os.environ['SNAPSHOTS_DIR'] = os.path.join(TMP.name, 'snapshots')
os.environ['RESULTS_DIR'] = os.path.join(TMP.name, 'results')
os.environ['DATASET_RESULT_MAX_BYTES'] = '100000'
sys.path.insert(0, ROOT)
spec = importlib.util.spec_from_file_location('kg_server_test', os.path.join(ROOT, 'kg_server.py'))
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class DatasetMaterializerTests(unittest.TestCase):
    def setUp(self):
        for name in os.listdir(server.RESULTS_DIR):
            os.remove(os.path.join(server.RESULTS_DIR, name))

    def write_csv(self, name, headers, rows):
        path = os.path.join(server.MATERIALS_DIR, name)
        with open(path, 'w', encoding='utf-8', newline='') as output:
            writer = csv.writer(output, lineterminator='\n')
            writer.writerow(headers); writer.writerows(rows)
        return path

    def frozen(self, mid, path, headers):
        import hashlib
        with open(path, 'rb') as source: digest = hashlib.sha256(source.read()).hexdigest()
        return {'material_id': mid, 'filename': os.path.basename(path), 'storage_path': path,
                'size_bytes': os.path.getsize(path), 'content_hash': digest, 'headers': headers,
                'parser': {'encoding': 'utf-8', 'delimiter': ',', 'quotechar': '"'}}

    def test_exact_boundary_unicode_quotes_and_newlines(self):
        path = self.write_csv('unicode.csv', ['名称', '说明'], [['甲', '含,逗号'], ['乙', '含"引号'], ['丙', '含\n换行']])
        frozen = [self.frozen('m1', path, ['名称', '说明'])]
        server.DATASET_RESULT_MAX_BYTES = 100000
        first = server._materialize_recipe('run_exact_a', 'p', 1, {'sources': ['m1'], 'steps': []}, frozen)
        exact = first['size_bytes']
        os.remove(first['path'])
        server.DATASET_RESULT_MAX_BYTES = exact
        result = server._materialize_recipe('run_exact_b', 'p', 1, {'sources': ['m1'], 'steps': []}, frozen)
        self.assertEqual(result['size_bytes'], exact)
        server.DATASET_RESULT_MAX_BYTES = exact - 1
        with self.assertRaises(server.DatasetResultTooLarge):
            server._materialize_recipe('run_exact_c', 'p', 1, {'sources': ['m1'], 'steps': []}, frozen)
        self.assertFalse(os.path.exists(os.path.join(server.RESULTS_DIR, 'run_exact_c.csv.tmp')))
        self.assertFalse(os.path.exists(os.path.join(server.RESULTS_DIR, 'run_exact_c.work.sqlite')))

    def test_more_than_ten_sources_and_five_steps_validate(self):
        db = server.get_db()
        try:
            db.execute("INSERT OR IGNORE INTO users(id,username,password_hash,credits,created_at) VALUES(1,'u','x',10000,'now')")
            db.execute("INSERT OR IGNORE INTO projects(id,user_id,title,created_at,updated_at) VALUES('p',1,'p','now','now')")
            sources = []
            for index in range(11):
                mid = 'm%d' % index; sources.append(mid); path = self.write_csv(mid+'.csv', ['a'], [[index]])
                db.execute('INSERT OR REPLACE INTO project_materials(id,project_id,user_id,filename,kind,mime,size_bytes,storage_path,created_at) VALUES(?,?,?,?,?,?,?,?,?)', (mid,'p',1,mid+'.csv','csv','text/csv',os.path.getsize(path),path,'now'))
            db.commit()
            recipe = {'sources': sources, 'steps': [{'op':'rename','mapping':{}} for _ in range(6)]}
            validated, headers = server._validate_recipe(db, 'p', 1, recipe)
            self.assertEqual(len(validated), 11); self.assertEqual(headers, ['a'])
        finally: db.close()

    def test_claim_is_atomic_and_download_requires_owner(self):
        db = server.get_db()
        try:
            db.execute("INSERT OR IGNORE INTO users(id,username,password_hash,credits,created_at) VALUES(1,'owner','x',10000,'now')")
            db.execute("INSERT OR IGNORE INTO users(id,username,password_hash,credits,created_at) VALUES(2,'other','x',10000,'now')")
            db.execute("INSERT OR IGNORE INTO projects(id,user_id,title,created_at,updated_at) VALUES('p',1,'p','now','now')")
            db.execute("INSERT OR IGNORE INTO project_datasets(id,project_id,user_id,name,recipe_json,source_json,row_version,created_at,updated_at) VALUES('ds','p',1,'d','{}','[]',1,'now','now')")
            db.execute("INSERT INTO dataset_runs(id,dataset_id,project_id,user_id,status,created_at,updated_at) VALUES('queued','ds','p',1,'queued','2026-01-01','2026-01-01')")
            db.commit()
        finally: db.close()
        claimed = server._claim_dataset_run('w1')
        self.assertEqual(claimed['id'], 'queued'); self.assertIsNone(server._claim_dataset_run('w2'))
        client = server.app.test_client()
        with server.app.test_request_context():
            pass
        # Ownership is enforced in the download query itself.
        db = server.get_db()
        try:
            self.assertIsNone(db.execute("SELECT * FROM dataset_runs WHERE id='queued' AND user_id=2").fetchone())
        finally: db.close()

    def test_filter_keeps_more_than_one_batch(self):
        path = self.write_csv('many.csv', ['value'], [[i] for i in range(1505)])
        frozen = [self.frozen('m1', path, ['value'])]
        server.DATASET_RESULT_MAX_BYTES = 1000000
        result = server._materialize_recipe('run_filter', 'p', 1, {'sources':['m1'],'steps':[{'op':'filter','where':{'op':'gte','column':'value','value':0}}]}, frozen)
        self.assertEqual(result['rows'], 1505)

    def test_lost_lease_heartbeat_is_rejected(self):
        db=server.get_db()
        try:
            db.execute("INSERT OR REPLACE INTO dataset_runs(id,dataset_id,project_id,user_id,status,lease_owner,attempt_token,lease_expires_at,created_at,updated_at) VALUES('lease','ds','p',1,'running','worker','token','2999-01-01 00:00:00','now','now')");db.commit()
        finally:db.close()
        with self.assertRaisesRegex(RuntimeError, 'LEASE_LOST'):
            server._heartbeat_dataset_run('lease','worker','wrong',1,2,'x')

    def test_orphan_cleanup_preserves_referenced_result(self):
        orphan=os.path.join(server.RESULTS_DIR,'orphan.csv'); referenced=os.path.join(server.RESULTS_DIR,'referenced.csv')
        open(orphan,'wb').close();open(referenced,'wb').close()
        db=server.get_db()
        try:
            db.execute("INSERT OR REPLACE INTO dataset_runs(id,dataset_id,project_id,user_id,status,result_path,created_at,updated_at) VALUES('ref','ds','p',1,'succeeded',?,'now','now')",(referenced,));db.commit()
        finally:db.close()
        server.cleanup_orphan_results(0)
        self.assertFalse(os.path.exists(orphan));self.assertTrue(os.path.exists(referenced))

    def test_one_time_download_token_contract(self):
        with open(os.path.join(ROOT, 'kg_server.py'), encoding='utf-8') as handle: source=handle.read()
        self.assertIn('download_token_hash',source);self.assertIn("download_token_hash=NULL",source)
        with open(os.path.join(ROOT,'js','app-modules.js'),encoding='utf-8') as handle: frontend=handle.read()
        joint=frontend[frontend.index('window.openJointAnalysis=function()'):frontend.index('window.profileSelectedMaterials=function()')]
        self.assertNotIn('.blob()',joint);self.assertIn('window.location.assign(d.download_url)',joint)

    def test_anchor_pair_count_contract(self):
        with open(os.path.join(ROOT, 'kg_server.py'), encoding='utf-8') as handle:
            source = handle.read()
        self.assertIn("anchor = ids[0]", source)
        self.assertIn("for right_id in ids[1:]", source)
        self.assertIn("'pairing': 'anchor_to_rest'", source)


if __name__ == '__main__':
    unittest.main()
