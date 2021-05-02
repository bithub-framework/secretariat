CREATE TABLE history (
    pid     VARCHAR(32)     NOT NULL,
    key     VARCHAR(16)     NOT NULL,
    value   JSON            NOT NULL,
    time    BIGINT          NOT NULL
);

CREATE INDEX index_time ON history (time);
