package com.gh.quant.platform.domain.entity

import com.gh.quant.platform.domain.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.OffsetDateTime
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes

@Entity
@Table(name = "jobs")
class Job(
    @Column(name = "job_type", nullable = false, length = 100)
    var jobType: String = "",
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_job_id")
    var parentJob: Job? = null,
    @Column(nullable = false, length = 50)
    var status: String = "PENDING",
    @Column(name = "started_at")
    var startedAt: OffsetDateTime? = null,
    @Column(name = "finished_at")
    var finishedAt: OffsetDateTime? = null,
    @Column(columnDefinition = "TEXT")
    var message: String? = null,
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata_json", columnDefinition = "jsonb")
    var metadataJson: String? = null,
) : BaseEntity()

@Entity
@Table(name = "data_sources")
class DataSource(
    @Column(nullable = false)
    var name: String = "",
    @Column(nullable = false)
    var provider: String = "",
    @Column(nullable = false, length = 50)
    var status: String = "ACTIVE",
    @Column(name = "last_sync_time")
    var lastSyncTime: OffsetDateTime? = null,
) : BaseEntity()

@Entity
@Table(name = "data_update_log")
class DataUpdateLog(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_id", nullable = false)
    var source: DataSource? = null,
    @Column(name = "table_name", nullable = false)
    var tableName: String = "",
    @Column(name = "rows_updated", nullable = false)
    var rowsUpdated: Long = 0,
    @Column(name = "started_at")
    var startedAt: OffsetDateTime? = null,
    @Column(name = "finished_at")
    var finishedAt: OffsetDateTime? = null,
) : BaseEntity()

@Entity
@Table(name = "api_keys")
class ApiKey(
    @Column(nullable = false)
    var provider: String = "",
    @Column(name = "api_key", nullable = false, length = 1000)
    var apiKey: String = "",
    @Column(nullable = false, length = 50)
    var status: String = "ACTIVE",
) : BaseEntity()

@Entity
@Table(name = "system_settings")
class SystemSetting(
    @Column(name = "setting_key", nullable = false, unique = true)
    var settingKey: String = "",
    @Column(name = "setting_value", nullable = false, columnDefinition = "TEXT")
    var settingValue: String = "",
) : BaseEntity()

@Entity
@Table(name = "activity_logs")
class ActivityLog(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    var user: User? = null,
    @Column(name = "activity_type", nullable = false, length = 100)
    var activityType: String = "",
    @Column(columnDefinition = "TEXT")
    var description: String? = null,
) : BaseEntity()
