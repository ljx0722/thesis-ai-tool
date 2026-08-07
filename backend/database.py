"""
论文搭子 ThesisBuddy - 数据库层
SQLite 连接管理、Schema 初始化、迁移。
"""
import sqlite3
import os
from backend.config import DB_PATH


def get_db():
    """获取数据库连接（每个请求/线程独立）。"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """初始化数据库表结构和索引。幂等，首次调用时创建所有表。"""
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            credits INTEGER NOT NULL DEFAULT 5,
            is_admin INTEGER NOT NULL DEFAULT 0,
            invite_code TEXT,
            invited_by TEXT,
            free_used_date TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS recharge_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount_yuan REAL NOT NULL,
            amount_fen INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            payment_method TEXT DEFAULT 'alipay',
            created_at TEXT,
            confirmed_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount_credits INTEGER NOT NULL,
            credits_after INTEGER NOT NULL,
            description TEXT,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS llm_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            module TEXT NOT NULL,
            prompt_tokens INTEGER NOT NULL DEFAULT 0,
            completion_tokens INTEGER NOT NULL DEFAULT 0,
            cost_credits INTEGER NOT NULL DEFAULT 0,
            user_charged_credits INTEGER NOT NULL DEFAULT 0,
            model TEXT NOT NULL DEFAULT 'deepseek-chat',
            success INTEGER NOT NULL DEFAULT 0,
            job_id TEXT,
            provider TEXT,
            provider_request_id TEXT,
            api_cost_microyuan INTEGER,
            cost_precision TEXT,
            cached_input_tokens INTEGER NOT NULL DEFAULT 0,
            reasoning_tokens INTEGER NOT NULL DEFAULT 0,
            total_tokens INTEGER NOT NULL DEFAULT 0,
            latency_ms INTEGER,
            error_code TEXT,
            pricing_snapshot_json TEXT,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS daily_free_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            usage_date TEXT NOT NULL,
            used INTEGER NOT NULL DEFAULT 0,
            UNIQUE(user_id, usage_date),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS invite_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            owner_id INTEGER NOT NULL,
            used_by INTEGER,
            used_at TEXT,
            created_at TEXT,
            FOREIGN KEY (owner_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            idea TEXT,
            field TEXT,
            keywords TEXT,
            degree TEXT,
            goal_words INTEGER DEFAULT 30000,
            current_stage TEXT,
            mode TEXT,
            has_manuscript INTEGER DEFAULT 0,
            stage_status TEXT,
            school_template TEXT,
            notes TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS project_materials (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            kind TEXT,
            mime TEXT,
            size_bytes INTEGER DEFAULT 0,
            storage_path TEXT NOT NULL,
            meta_json TEXT,
            created_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS capability_runs (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            project_id TEXT,
            capability_id TEXT NOT NULL,
            idempotency_key TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'running',
            pricing_key TEXT,
            price_credits INTEGER NOT NULL DEFAULT 0,
            pricing_snapshot_json TEXT,
            input_hash TEXT,
            transaction_id INTEGER,
            refund_transaction_id INTEGER,
            result_json TEXT,
            error_json TEXT,
            metadata_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            finished_at TEXT,
            UNIQUE(user_id, capability_id, idempotency_key),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS data_material_profiles (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            material_id TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            parser_version TEXT NOT NULL,
            fingerprint TEXT NOT NULL,
            profile_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(material_id, content_hash),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (material_id) REFERENCES project_materials(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS project_datasets (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            recipe_json TEXT NOT NULL,
            source_json TEXT NOT NULL,
            schema_json TEXT,
            row_version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS dataset_relationships (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            left_source_id TEXT NOT NULL,
            right_source_id TEXT NOT NULL,
            relationship_json TEXT NOT NULL,
            fingerprint TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(project_id, fingerprint),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS dataset_runs (
            id TEXT PRIMARY KEY,
            dataset_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            capability_run_id TEXT,
            status TEXT NOT NULL,
            result_json TEXT,
            provenance_json TEXT,
            billing_json TEXT,
            error_json TEXT,
            created_at TEXT NOT NULL,
            finished_at TEXT,
            FOREIGN KEY (dataset_id) REFERENCES project_datasets(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (capability_run_id) REFERENCES capability_runs(id)
        );
        CREATE TABLE IF NOT EXISTS pricing_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            config_json TEXT NOT NULL,
            effective_at TEXT NOT NULL,
            created_by INTEGER,
            created_at TEXT,
            is_active INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS project_artifacts (
            project_id TEXT PRIMARY KEY,
            outline_json TEXT,
            chapters_json TEXT,
            versions_json TEXT,
            skill_logs_json TEXT,
            manuscript_meta_json TEXT,
            figures_json TEXT,
            figure_plans_json TEXT,
            exports_json TEXT,
            data_profiles_json TEXT,
            model_runs_json TEXT,
            literature_json TEXT,
            literature_version INTEGER DEFAULT 1,
            updated_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id)
        );
        CREATE TABLE IF NOT EXISTS service_runtime_state (
            id INTEGER PRIMARY KEY CHECK (id=1),
            mode TEXT NOT NULL DEFAULT 'normal',
            message TEXT NOT NULL DEFAULT '',
            starts_at TEXT,
            deadline_at TEXT,
            target_version TEXT,
            target_commit TEXT,
            updated_by TEXT,
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL DEFAULT 'system',
            title TEXT NOT NULL,
            body TEXT,
            is_read INTEGER NOT NULL DEFAULT 0,
            meta_json TEXT,
            created_at TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            actor_id INTEGER,
            actor_name TEXT,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id TEXT,
            detail TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS manuscript_revisions (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            revision_no INTEGER NOT NULL,
            source_type TEXT NOT NULL DEFAULT 'import',
            status TEXT NOT NULL DEFAULT 'draft',
            original_material_id TEXT,
            snapshot_path TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            file_name TEXT,
            file_kind TEXT,
            mime TEXT,
            size_bytes INTEGER DEFAULT 0,
            parser_version TEXT,
            structure_summary_json TEXT,
            calibration_json TEXT,
            created_at TEXT,
            activated_at TEXT,
            deleted_at TEXT,
            UNIQUE(project_id, revision_no),
            UNIQUE(project_id, content_hash),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS ai_jobs (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            project_id TEXT,
            revision_id TEXT,
            capability_id TEXT NOT NULL,
            capability_version TEXT NOT NULL,
            idempotency_key TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'created',
            model TEXT,
            provider TEXT,
            provider_request_id TEXT,
            pricing_snapshot_json TEXT,
            pricing_snapshot_hash TEXT,
            usage_json TEXT,
            estimated_credits INTEGER NOT NULL DEFAULT 0,
            actual_credits INTEGER NOT NULL DEFAULT 0,
            prompt_tokens INTEGER NOT NULL DEFAULT 0,
            completion_tokens INTEGER NOT NULL DEFAULT 0,
            output_json TEXT,
            error TEXT,
            created_at TEXT,
            started_at TEXT,
            finished_at TEXT,
            UNIQUE(user_id, idempotency_key),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS credit_reservations (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL UNIQUE,
            user_id INTEGER NOT NULL,
            amount_credits INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'held',
            created_at TEXT,
            settled_at TEXT,
            FOREIGN KEY (job_id) REFERENCES ai_jobs(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS rag_chunks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            material_id TEXT NOT NULL,
            ordinal INTEGER NOT NULL,
            heading TEXT,
            page_no INTEGER,
            content TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            created_at TEXT,
            UNIQUE(material_id, ordinal),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (material_id) REFERENCES project_materials(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS graph_nodes (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            revision_id TEXT,
            node_type TEXT NOT NULL,
            label TEXT NOT NULL,
            data_json TEXT,
            confidence REAL DEFAULT 0,
            review_status TEXT DEFAULT 'unreviewed',
            created_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS graph_edges (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            revision_id TEXT,
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            relation TEXT NOT NULL,
            confidence REAL DEFAULT 0,
            review_status TEXT DEFAULT 'unreviewed',
            data_json TEXT,
            created_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS graph_evidence (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            edge_id TEXT,
            node_id TEXT,
            material_id TEXT,
            reference_no INTEGER,
            chunk_id TEXT,
            excerpt TEXT,
            start_offset INTEGER,
            end_offset INTEGER,
            extractor_version TEXT,
            created_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS project_context_chunks (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            revision_id TEXT,
            chapter_id TEXT,
            source_type TEXT NOT NULL,
            source_id TEXT,
            title TEXT,
            ordinal INTEGER NOT NULL DEFAULT 0,
            content TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            metadata_json TEXT,
            created_at TEXT,
            UNIQUE(project_id, revision_id, source_type, source_id, ordinal),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS project_pipeline_runs (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            revision_id TEXT NOT NULL,
            pipeline_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'created',
            input_json TEXT,
            output_json TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS project_pipeline_steps (
            id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            step_key TEXT NOT NULL,
            ordinal INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            input_json TEXT,
            output_json TEXT,
            created_at TEXT,
            updated_at TEXT,
            UNIQUE(run_id, step_key),
            FOREIGN KEY (run_id) REFERENCES project_pipeline_runs(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS assistant_conversations (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            title TEXT,
            revision_id TEXT,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS assistant_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user','assistant')),
            content TEXT NOT NULL,
            sources_json TEXT,
            revision_id TEXT,
            created_at TEXT,
            FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE
        );
    ''')
    conn.commit()

    # 迁移：兼容旧数据库
    _run_migrations(conn)

    conn.close()


def _run_migrations(conn):
    """运行增量迁移，确保旧数据库与新 schema 兼容。"""
    # recharge_orders 补充字段
    try:
        order_cols = [r[1] for r in conn.execute('PRAGMA table_info(recharge_orders)').fetchall()]
        if 'note' not in order_cols:
            conn.execute("ALTER TABLE recharge_orders ADD COLUMN note TEXT")
        if 'pay_proof' not in order_cols:
            conn.execute("ALTER TABLE recharge_orders ADD COLUMN pay_proof TEXT")
        conn.commit()
    except Exception:
        pass

    # 审计日志表兼容
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS audit_logs ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER, actor_name TEXT, "
            "action TEXT NOT NULL, target_type TEXT, target_id TEXT, detail TEXT, created_at TEXT)"
        )
        conn.commit()
    except Exception:
        pass

    # 通知表兼容
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS notifications ("
            "id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'system', "
            "title TEXT NOT NULL, body TEXT, is_read INTEGER NOT NULL DEFAULT 0, meta_json TEXT, created_at TEXT)"
        )
        conn.commit()
    except Exception:
        pass

    # projects 表迁移
    try:
        project_cols = [r[1] for r in conn.execute('PRAGMA table_info(projects)').fetchall()]
        if 'active_revision_id' not in project_cols:
            conn.execute("ALTER TABLE projects ADD COLUMN active_revision_id TEXT")
        if 'last_view' not in project_cols:
            conn.execute("ALTER TABLE projects ADD COLUMN last_view TEXT DEFAULT 'workspace'")
        if 'row_version' not in project_cols:
            conn.execute("ALTER TABLE projects ADD COLUMN row_version INTEGER NOT NULL DEFAULT 1")
        conn.commit()
    except Exception as e:
        conn.close()
        raise RuntimeError(f'项目表迁移失败: {e}')

    # llm_usage / ai_jobs 补充字段
    try:
        usage_cols = [r[1] for r in conn.execute('PRAGMA table_info(llm_usage)').fetchall()]
        usage_additions = {
            'job_id': 'TEXT', 'provider': 'TEXT', 'provider_request_id': 'TEXT',
            'api_cost_microyuan': 'INTEGER', 'cost_precision': 'TEXT',
            'cached_input_tokens': 'INTEGER NOT NULL DEFAULT 0',
            'reasoning_tokens': 'INTEGER NOT NULL DEFAULT 0',
            'total_tokens': 'INTEGER NOT NULL DEFAULT 0', 'latency_ms': 'INTEGER',
            'error_code': 'TEXT', 'pricing_snapshot_json': 'TEXT'
        }
        for col, ddl in usage_additions.items():
            if col not in usage_cols:
                conn.execute(f'ALTER TABLE llm_usage ADD COLUMN {col} {ddl}')
        job_cols = [r[1] for r in conn.execute('PRAGMA table_info(ai_jobs)').fetchall()]
        job_additions = {
            'provider': 'TEXT', 'provider_request_id': 'TEXT',
            'pricing_snapshot_json': 'TEXT', 'pricing_snapshot_hash': 'TEXT',
            'usage_json': 'TEXT'
        }
        for col, ddl in job_additions.items():
            if col not in job_cols:
                conn.execute(f'ALTER TABLE ai_jobs ADD COLUMN {col} {ddl}')
        conn.execute("UPDATE llm_usage SET api_cost_microyuan=cost_credits*10000, cost_precision='legacy_fen' WHERE api_cost_microyuan IS NULL AND cost_credits>0")
        conn.execute("UPDATE llm_usage SET cost_precision='legacy_unrecoverable' WHERE cost_precision IS NULL AND cost_credits=0")
        conn.execute("UPDATE llm_usage SET total_tokens=COALESCE(prompt_tokens,0)+COALESCE(completion_tokens,0) WHERE total_tokens=0")
        artifact_cols = [r[1] for r in conn.execute('PRAGMA table_info(project_artifacts)').fetchall()]
        for col in ('figures_json', 'figure_plans_json', 'exports_json', 'data_profiles_json', 'model_runs_json', 'literature_json'):
            if col not in artifact_cols:
                conn.execute(f'ALTER TABLE project_artifacts ADD COLUMN {col} TEXT')
        if 'literature_version' not in artifact_cols:
            conn.execute('ALTER TABLE project_artifacts ADD COLUMN literature_version INTEGER DEFAULT 1')
        conn.execute("INSERT OR IGNORE INTO service_runtime_state(id,mode,message,updated_at) VALUES(1,'normal','',datetime('now','localtime'))")
        conn.commit()
    except Exception as e:
        conn.close()
        raise RuntimeError(f'运营数据迁移失败: {e}')

    # 数据集表迁移
    try:
        dataset_cols = [r[1] for r in conn.execute('PRAGMA table_info(project_datasets)').fetchall()]
        dataset_additions = {
            'last_run_id': 'TEXT', 'materialized_at': 'TEXT', 'result_status': "TEXT NOT NULL DEFAULT 'none'"
        }
        for col, ddl in dataset_additions.items():
            if col not in dataset_cols:
                conn.execute(f'ALTER TABLE project_datasets ADD COLUMN {col} {ddl}')
        run_cols = [r[1] for r in conn.execute('PRAGMA table_info(dataset_runs)').fetchall()]
        run_additions = {
            'idempotency_key': 'TEXT', 'recipe_json': 'TEXT', 'frozen_inputs_json': 'TEXT',
            'result_path': 'TEXT', 'result_filename': 'TEXT', 'result_sha256': 'TEXT',
            'result_size_bytes': 'INTEGER', 'result_rows': 'INTEGER', 'result_columns_json': 'TEXT',
            'progress_current': 'INTEGER NOT NULL DEFAULT 0', 'progress_total': 'INTEGER NOT NULL DEFAULT 0',
            'progress_message': 'TEXT', 'attempts': 'INTEGER NOT NULL DEFAULT 0',
            'lease_owner': 'TEXT', 'lease_expires_at': 'TEXT', 'heartbeat_at': 'TEXT',
            'started_at': 'TEXT', 'updated_at': 'TEXT', 'cancel_requested': 'INTEGER NOT NULL DEFAULT 0',
            'attempt_token': 'TEXT', 'download_token_hash': 'TEXT', 'download_token_expires_at': 'TEXT'
        }
        for col, ddl in run_additions.items():
            if col not in run_cols:
                conn.execute(f'ALTER TABLE dataset_runs ADD COLUMN {col} {ddl}')
        conn.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_dataset_runs_capability ON dataset_runs(capability_run_id) WHERE capability_run_id IS NOT NULL')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_dataset_runs_queue ON dataset_runs(status, lease_expires_at, created_at)')
        conn.commit()
    except Exception as e:
        conn.close()
        raise RuntimeError(f'数据集任务迁移失败: {e}')

    # 创建所有索引
    for idx_sql in [
        'CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at)',
        'CREATE INDEX IF NOT EXISTS idx_materials_project_user ON project_materials(project_id, user_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_revisions_project_user ON manuscript_revisions(project_id, user_id, revision_no)',
        'CREATE INDEX IF NOT EXISTS idx_rag_project_user ON rag_chunks(project_id, user_id, material_id)',
        'CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON ai_jobs(user_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at, id)',
        'CREATE INDEX IF NOT EXISTS idx_orders_status_id ON recharge_orders(status, id)',
        'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON recharge_orders(user_id, id)',
        'CREATE INDEX IF NOT EXISTS idx_transactions_type_id ON transactions(type, id)',
        'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id, id)',
        'CREATE INDEX IF NOT EXISTS idx_llm_usage_created ON llm_usage(created_at, id)',
        'CREATE INDEX IF NOT EXISTS idx_llm_usage_user_created ON llm_usage(user_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at, id)',
        'CREATE INDEX IF NOT EXISTS idx_graph_nodes_project ON graph_nodes(project_id, revision_id)',
        'CREATE INDEX IF NOT EXISTS idx_graph_edges_project ON graph_edges(project_id, revision_id)',
        'CREATE INDEX IF NOT EXISTS idx_context_project_revision ON project_context_chunks(project_id, revision_id)',
        'CREATE INDEX IF NOT EXISTS idx_pipeline_project_created ON project_pipeline_runs(project_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_pipeline_steps_run ON project_pipeline_steps(run_id, ordinal)',
        'CREATE INDEX IF NOT EXISTS idx_assistant_conversations_project ON assistant_conversations(project_id, user_id, updated_at)',
        'CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation ON assistant_messages(conversation_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_capability_runs_project ON capability_runs(project_id, user_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_profiles_project_material ON data_material_profiles(project_id, material_id, updated_at)',
        'CREATE INDEX IF NOT EXISTS idx_datasets_project_user ON project_datasets(project_id, user_id, updated_at)',
        'CREATE INDEX IF NOT EXISTS idx_relationships_project ON dataset_relationships(project_id, created_at)',
        'CREATE INDEX IF NOT EXISTS idx_dataset_runs_dataset ON dataset_runs(dataset_id, user_id, created_at)'
    ]:
        conn.execute(idx_sql)
    conn.commit()
