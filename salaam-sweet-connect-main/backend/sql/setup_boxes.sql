-- ═══════════════════════════════════════════════════════════════════
-- نظام البوكسات (Loan Boxes / Kits) — Template + Instances
-- ───────────────────────────────────────────────────────────────────
-- boxes           = قالب البوكس (مثلاً "Arduino Kit")
-- box_items       = محتويات القالب
-- box_instances   = نسخ فعليّة من القالب، لكلّ نسخة QR خاص (ARD-001 …)
-- box_loans       = استعارات؛ تشير إلى نسخة (instance) لا إلى القالب
-- box_returns     = checklist الإرجاع التفصيلي
-- ═══════════════════════════════════════════════════════════════════

-- ── القالب ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS boxes (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(150)  NOT NULL,
    name_en         VARCHAR(150)  DEFAULT '',
    description     TEXT          DEFAULT NULL,
    image_url       VARCHAR(500)  DEFAULT NULL,
    category        VARCHAR(100)  DEFAULT 'عام',
    code_prefix     VARCHAR(20)   DEFAULT 'BX',
    is_hidden       TINYINT(1)    NOT NULL DEFAULT 0,
    created_by      VARCHAR(50)   DEFAULT NULL,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── محتويات القالب ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS box_items (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    box_id              INT          NOT NULL,
    item_name           VARCHAR(150) NOT NULL,
    quantity_required   INT          NOT NULL DEFAULT 1,
    notes               VARCHAR(255) DEFAULT NULL,
    FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE,
    INDEX idx_box (box_id),
    INDEX idx_item (item_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── النسخ الفعليّة (لكل نسخة QR لحالها) ───────────────────────────
CREATE TABLE IF NOT EXISTS box_instances (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    box_id      INT          NOT NULL,
    qr_code     VARCHAR(100) NOT NULL UNIQUE,
    label       VARCHAR(50)  NOT NULL,
    status      ENUM('available','loaned','maintenance','retired') DEFAULT 'available',
    notes       VARCHAR(500) DEFAULT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (box_id) REFERENCES boxes(id) ON DELETE CASCADE,
    INDEX idx_box (box_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── الاستعارات (تشير لنسخة بعينها) ────────────────────────────────
CREATE TABLE IF NOT EXISTS box_loans (
    id                      INT AUTO_INCREMENT PRIMARY KEY,
    box_id                  INT          NOT NULL,
    instance_id             INT          DEFAULT NULL,
    university_id           VARCHAR(50)  NOT NULL,
    student_name            VARCHAR(100) DEFAULT NULL,
    checkout_date           DATE         NOT NULL,
    expected_return_date    DATE         NOT NULL,
    returned_at             DATETIME     DEFAULT NULL,
    status                  ENUM('active','returned','overdue','partial_return') DEFAULT 'active',
    notes                   TEXT         DEFAULT NULL,
    issued_by               VARCHAR(50)  DEFAULT NULL,
    received_by             VARCHAR(50)  DEFAULT NULL,
    created_at              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (box_id)      REFERENCES boxes(id)          ON DELETE CASCADE,
    INDEX idx_box      (box_id),
    INDEX idx_instance (instance_id),
    INDEX idx_student  (university_id),
    INDEX idx_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ── سجل الإرجاع التفصيلي (Checklist) ──────────────────────────────
CREATE TABLE IF NOT EXISTS box_returns (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    loan_id             INT          NOT NULL,
    item_name           VARCHAR(150) NOT NULL,
    quantity_expected   INT          NOT NULL DEFAULT 1,
    quantity_returned   INT          NOT NULL DEFAULT 0,
    condition_status    ENUM('good','damaged','missing') DEFAULT 'good',
    notes               VARCHAR(500) DEFAULT NULL,
    checked_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES box_loans(id) ON DELETE CASCADE,
    INDEX idx_loan (loan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
