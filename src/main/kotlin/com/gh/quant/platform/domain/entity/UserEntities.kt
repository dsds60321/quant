package com.gh.quant.platform.domain.entity

import com.gh.quant.platform.domain.common.BaseEntity
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Table

@Entity
@Table(name = "users")
class User(
    @Column(nullable = false, unique = true, length = 255)
    var email: String = "",
    @Column(nullable = false, length = 255)
    var password: String = "",
    @Column(nullable = false, length = 120)
    var name: String = "",
    @Column(nullable = false, length = 50)
    var role: String = "",
    @Column(nullable = false, length = 50)
    var status: String = "",
) : BaseEntity()
